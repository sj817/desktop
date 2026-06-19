//! Network helpers. Mirrors network channels in app/src/lib/ipc-shared.ts.

use crate::error::AppResult;

/// Read an env var by its conventional UPPERCASE name, falling back to the
/// lowercase variant (curl/git honor both), treating blank values as unset.
fn proxy_env(upper: &str) -> Option<String> {
    std::env::var(upper)
        .ok()
        .or_else(|| std::env::var(upper.to_ascii_lowercase()).ok())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Extract the lowercased (scheme, host) from a URL without pulling in a URL
/// crate. Returns None for inputs we can't make sense of (caller treats as DIRECT).
fn scheme_and_host(url: &str) -> Option<(String, String)> {
    let (scheme, rest) = url.split_once("://")?;
    // Drop path/query/fragment.
    let authority = rest.split(['/', '?', '#']).next().unwrap_or(rest);
    // Drop userinfo (user:pass@host).
    let host_port = authority.rsplit_once('@').map_or(authority, |(_, h)| h);
    // Strip the port, handling bracketed IPv6 literals ([::1]:443).
    let host = if let Some(after) = host_port.strip_prefix('[') {
        after.split(']').next().unwrap_or(after)
    } else {
        host_port.split(':').next().unwrap_or(host_port)
    };
    if host.is_empty() {
        return None;
    }
    Some((scheme.to_ascii_lowercase(), host.to_ascii_lowercase()))
}

/// Does `host` match any entry in a NO_PROXY list (comma-separated, suffix match,
/// `*` for all)?
fn bypasses_proxy(host: &str, no_proxy: &str) -> bool {
    no_proxy.split(',').any(|raw| {
        let entry = raw.trim().trim_start_matches('.').to_ascii_lowercase();
        if entry.is_empty() {
            return false;
        }
        entry == "*" || host == entry || host.ends_with(&format!(".{entry}"))
    })
}

/// Convert a proxy URL (or bare `host:port`) into a single-spec PAC string the
/// renderer's parse-pac-string.ts understands, e.g. "PROXY host:8080".
fn proxy_to_pac(proxy: &str) -> Option<String> {
    let (scheme, rest) = match proxy.split_once("://") {
        Some((s, r)) => (s.to_ascii_lowercase(), r),
        None => ("http".to_string(), proxy), // bare host:port
    };
    let endpoint = rest.split(['/', '?', '#']).next().unwrap_or(rest);
    let endpoint = endpoint.rsplit_once('@').map_or(endpoint, |(_, h)| h);
    if endpoint.is_empty() {
        return None;
    }

    let proxy_type = match scheme.as_str() {
        "https" => "HTTPS",
        "socks5" | "socks5h" => "SOCKS5",
        "socks" | "socks4" | "socks4a" => "SOCKS",
        // http and anything unrecognized map to a plain forward proxy.
        _ => "PROXY",
    };
    Some(format!("{proxy_type} {endpoint}"))
}

/// `resolve-proxy` (RequestResponseChannels) — resolve the proxy for a URL.
///
/// Tauri has no Chromium proxy resolver, so we honor the standard
/// HTTP(S)_PROXY / ALL_PROXY / NO_PROXY environment variables (the de-facto
/// cross-platform convention git/curl already follow) and return a PAC string.
/// "DIRECT" means no proxy.
#[tauri::command]
pub fn resolve_proxy(url: String) -> AppResult<String> {
    let Some((scheme, host)) = scheme_and_host(&url) else {
        return Ok("DIRECT".to_string());
    };

    if let Some(no_proxy) = proxy_env("NO_PROXY") {
        if bypasses_proxy(&host, &no_proxy) {
            return Ok("DIRECT".to_string());
        }
    }

    let proxy = if scheme == "https" {
        proxy_env("HTTPS_PROXY").or_else(|| proxy_env("ALL_PROXY"))
    } else {
        proxy_env("HTTP_PROXY").or_else(|| proxy_env("ALL_PROXY"))
    };

    Ok(proxy
        .and_then(|p| proxy_to_pac(&p))
        .unwrap_or_else(|| "DIRECT".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_scheme_and_host() {
        assert_eq!(
            scheme_and_host("https://github.com/owner/repo"),
            Some(("https".into(), "github.com".into()))
        );
        // Userinfo and port are stripped.
        assert_eq!(
            scheme_and_host("http://user:pass@Host.Example:8080/path?q=1"),
            Some(("http".into(), "host.example".into()))
        );
        // Bracketed IPv6 literal.
        assert_eq!(
            scheme_and_host("https://[::1]:443/"),
            Some(("https".into(), "::1".into()))
        );
        // No scheme / no host => None (caller treats as DIRECT).
        assert_eq!(scheme_and_host("not-a-url"), None);
        assert_eq!(scheme_and_host("https://"), None);
    }

    #[test]
    fn no_proxy_suffix_matching() {
        assert!(bypasses_proxy("github.com", "github.com"));
        // Subdomain matches a bare domain entry.
        assert!(bypasses_proxy("api.github.com", "github.com"));
        // Leading dot and surrounding whitespace are tolerated.
        assert!(bypasses_proxy(
            "api.github.com",
            " .github.com , example.org "
        ));
        // Wildcard bypasses everything.
        assert!(bypasses_proxy("anything.example", "*"));
        // A suffix that isn't a dot-boundary must NOT match.
        assert!(!bypasses_proxy("github.com.evil.com", "github.com"));
        assert!(!bypasses_proxy("github.com", "gitlab.com"));
    }

    #[test]
    fn proxy_url_to_pac_spec() {
        assert_eq!(
            proxy_to_pac("http://proxy:8080").as_deref(),
            Some("PROXY proxy:8080")
        );
        assert_eq!(
            proxy_to_pac("https://p:3128").as_deref(),
            Some("HTTPS p:3128")
        );
        assert_eq!(
            proxy_to_pac("socks5://s:1080").as_deref(),
            Some("SOCKS5 s:1080")
        );
        assert_eq!(proxy_to_pac("socks://s").as_deref(), Some("SOCKS s"));
        // A bare host:port defaults to a forward (HTTP) proxy.
        assert_eq!(
            proxy_to_pac("proxy:8080").as_deref(),
            Some("PROXY proxy:8080")
        );
        // Userinfo and trailing path are dropped from the endpoint.
        assert_eq!(
            proxy_to_pac("http://user:pass@p:8080/pac").as_deref(),
            Some("PROXY p:8080")
        );
        // Empty / endpoint-less inputs yield nothing.
        assert_eq!(proxy_to_pac("http://"), None);
    }
}
