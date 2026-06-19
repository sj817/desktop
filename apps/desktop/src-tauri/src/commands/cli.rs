//! Command-line integration: the `github` shell command and the argv handling
//! that routes `github [path]` / `github clone <url>` to the running app.
//!
//! Mirrors apps/desktop/src/cli/main.ts (arg grammar) and the renderer's
//! `cli-action` channel (apps/desktop/src/ui/index.tsx), which dispatches
//! { kind: 'open-repository', path } and { kind: 'clone-url', url, branch? }.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::error::{AppResult, blocking};

/// A cold-start CLI action stashed until the renderer signals readiness
/// (events have no listeners before the UI mounts).
#[derive(Default)]
pub struct PendingCliAction(pub Mutex<Option<Value>>);

/// The marker our trampoline always passes, distinguishing a CLI launch from a
/// normal app launch (double-click). Without it we never treat argv as a command.
const CLI_CWD_FLAG: &str = "--cli-cwd=";

/// Parse a github-style argv into a `cli-action` payload, or None if this isn't
/// a CLI launch / there's nothing to do.
fn parse_cli_action(argv: &[String], fallback_cwd: &str) -> Option<Value> {
    let mut saw_marker = false;
    let mut cwd = fallback_cwd.to_string();
    let mut positionals: Vec<String> = Vec::new();
    let mut branch: Option<String> = None;

    let mut iter = argv.iter().skip(1).peekable(); // skip the program path
    while let Some(arg) = iter.next() {
        if let Some(v) = arg.strip_prefix(CLI_CWD_FLAG) {
            saw_marker = true;
            if !v.is_empty() {
                cwd = v.to_string();
            }
        } else if arg == "-b" || arg == "--branch" {
            branch = iter.next().cloned();
        } else if let Some(v) = arg.strip_prefix("--branch=") {
            branch = Some(v.to_string());
        } else if arg.starts_with('-') {
            // Ignore other flags (e.g. --protocol-launcher).
        } else {
            positionals.push(arg.clone());
        }
    }

    if !saw_marker {
        return None;
    }

    let first = positionals.first().map(String::as_str);
    if first == Some("clone") {
        let url_arg = positionals.get(1)?;
        let url = if is_owner_repo_slug(url_arg) {
            format!("https://github.com/{url_arg}")
        } else {
            url_arg.clone()
        };
        let mut action = json!({ "kind": "clone-url", "url": url });
        if let Some(b) = branch {
            action["branch"] = Value::String(b);
        }
        Some(action)
    } else {
        // `open [path]` | `path` | (nothing -> the terminal's directory)
        let path_arg = if first == Some("open") {
            positionals.get(1).map(String::as_str)
        } else {
            first
        };
        Some(json!({ "kind": "open-repository", "path": resolve_path(&cwd, path_arg) }))
    }
}

/// Matches owner/repo slugs like `torvalds/linux` (exactly one slash, both
/// halves non-empty) — these expand to a github.com URL, as in cli/main.ts.
fn is_owner_repo_slug(s: &str) -> bool {
    let mut parts = s.split('/');
    matches!((parts.next(), parts.next(), parts.next()),
        (Some(a), Some(b), None) if !a.is_empty() && !b.is_empty())
}

/// Resolve a (possibly relative, possibly missing) path argument against the
/// terminal's working directory into an absolute path.
fn resolve_path(cwd: &str, path_arg: Option<&str>) -> String {
    let raw = path_arg.unwrap_or(".");
    let path = Path::new(raw);
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        Path::new(cwd).join(path)
    };
    // canonicalize resolves `.`/`..`; strip the Windows verbatim prefix it adds
    // so the renderer gets a plain path. Fall back to the lexical join.
    match std::fs::canonicalize(&absolute) {
        Ok(p) => strip_verbatim(p),
        Err(_) => absolute.to_string_lossy().to_string(),
    }
}

#[cfg(windows)]
fn strip_verbatim(p: PathBuf) -> String {
    let s = p.to_string_lossy().to_string();
    // \\?\C:\dir -> C:\dir (leave the rarer \\?\UNC\ form untouched).
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC\\") => rest.to_string(),
        _ => s,
    }
}

#[cfg(not(windows))]
fn strip_verbatim(p: PathBuf) -> String {
    p.to_string_lossy().to_string()
}

/// Bring the main window to the foreground (single-instance focus behaviour).
fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Second-instance handler (app already running): the renderer is listening, so
/// focus and emit the action directly.
pub fn handle_second_instance(app: &AppHandle, argv: Vec<String>, cwd: String) {
    focus_main_window(app);
    if let Some(action) = parse_cli_action(&argv, &cwd) {
        let _ = app.emit("cli-action", action);
    }
}

/// Cold-start handler: stash any CLI action to be flushed on `renderer_ready`.
pub fn handle_startup_args(app: &AppHandle) {
    let argv: Vec<String> = std::env::args().collect();
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    if let Some(action) = parse_cli_action(&argv, &cwd) {
        if let Some(state) = app.try_state::<PendingCliAction>() {
            *state.0.lock().unwrap() = Some(action);
        }
    }
}

/// `renderer-ready` — the UI has mounted and registered its listeners. Flush any
/// CLI action captured at cold start.
#[tauri::command]
pub fn renderer_ready(app: AppHandle) {
    // WebView2/WKWebView reapply their persisted per-host zoom factor as the page
    // loads, which lands *after* the setup() reset. By the time the UI reports
    // ready the restore has happened, so pin the zoom to 1.0 here to win — this
    // mirrors upstream pinning the zoom in the Electron main process. The View
    // menu still drives explicit zoom via set_window_zoom_factor afterwards.
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_zoom(1.0);
    }

    if let Some(state) = app.try_state::<PendingCliAction>() {
        let pending = state.0.lock().unwrap().take();
        if let Some(action) = pending {
            let _ = app.emit("cli-action", action);
        }
    }
}

#[cfg(windows)]
fn cli_bin_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app.path().app_local_data_dir()?;
    Ok(dir.join("bin"))
}

/// Write the `github.cmd` trampoline that launches this app with the caller's
/// working directory and forwarded arguments.
#[cfg(windows)]
fn write_trampoline(bin: &Path, exe: &Path) -> AppResult<()> {
    let script = format!(
        "@echo off\r\n\"{}\" {}\"%CD%\" %*\r\n",
        exe.display(),
        CLI_CWD_FLAG
    );
    std::fs::write(bin.join("github.cmd"), script)?;
    Ok(())
}

/// Read the user PATH from the registry, modify it, write it back, and
/// broadcast WM_SETTINGCHANGE so new shells pick it up. Direct registry
/// access via winreg (already a dependency) instead of shelling out to
/// PowerShell (~500ms startup penalty per invocation).
#[cfg(windows)]
fn read_user_path() -> AppResult<String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let env = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Environment")?;
    env.get_value::<String, _>("PATH")
        .or_else(|_| Ok(String::new()))
}

#[cfg(windows)]
fn write_user_path(new_path: &str) -> AppResult<()> {
    use winreg::enums::*;
    use winreg::RegKey;
    let (env, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey("Environment")?;
    env.set_value("PATH", &new_path)?;
    broadcast_environment_change();
    Ok(())
}

#[cfg(windows)]
fn broadcast_environment_change() {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    #[link(name = "user32")]
    extern "system" {
        fn SendMessageTimeoutW(
            hwnd: isize, msg: u32, wparam: usize, lparam: *const u16,
            flags: u32, timeout: u32, result: *mut usize,
        ) -> isize;
    }
    const HWND_BROADCAST: isize = 0xFFFF;
    const WM_SETTINGCHANGE: u32 = 0x001A;
    const SMTO_ABORTIFHUNG: u32 = 0x0002;
    let env: Vec<u16> = OsStr::new("Environment").encode_wide().chain(Some(0)).collect();
    unsafe {
        let mut _result: usize = 0;
        SendMessageTimeoutW(
            HWND_BROADCAST, WM_SETTINGCHANGE, 0, env.as_ptr(),
            SMTO_ABORTIFHUNG, 5000, &mut _result,
        );
    }
}

#[cfg(windows)]
fn add_to_user_path(bin: &Path) -> AppResult<()> {
    let bin_str = bin.to_string_lossy();
    let current = read_user_path()?;
    let parts: Vec<&str> = current.split(';').filter(|s| !s.is_empty()).collect();
    if parts.iter().any(|p| p.eq_ignore_ascii_case(&bin_str)) {
        return Ok(());
    }
    let mut new_parts: Vec<&str> = parts;
    let owned = bin_str.to_string();
    new_parts.push(&owned);
    write_user_path(&new_parts.join(";"))
}

#[cfg(windows)]
fn remove_from_user_path(bin: &Path) -> AppResult<()> {
    let bin_str = bin.to_string_lossy();
    let current = read_user_path()?;
    let new_path: String = current
        .split(';')
        .filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case(&bin_str))
        .collect::<Vec<_>>()
        .join(";");
    write_user_path(&new_path)
}

/// `install-windows-cli` — write the `github` trampoline and add it to PATH.
#[tauri::command]
pub async fn install_windows_cli(app: AppHandle) -> AppResult<()> {
    #[cfg(windows)]
    {
        let bin = cli_bin_dir(&app)?;
        blocking(move || {
            std::fs::create_dir_all(&bin)?;
            let exe = std::env::current_exe()?;
            write_trampoline(&bin, &exe)?;
            add_to_user_path(&bin)?;
            Ok(())
        })
        .await
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(())
    }
}

/// `uninstall-windows-cli` — remove the trampoline dir from PATH.
#[tauri::command]
pub async fn uninstall_windows_cli(app: AppHandle) -> AppResult<()> {
    #[cfg(windows)]
    {
        let bin = cli_bin_dir(&app)?;
        blocking(move || {
            remove_from_user_path(&bin)?;
            let _ = std::fs::remove_file(bin.join("github.cmd"));
            Ok(())
        })
        .await
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn ignores_non_cli_launches() {
        // No --cli-cwd marker => a normal (double-click) launch, never a command.
        assert!(parse_cli_action(&argv(&["app.exe"]), "/home").is_none());
        assert!(parse_cli_action(&argv(&["app.exe", "open", "/x"]), "/home").is_none());
    }

    #[test]
    fn owner_repo_slug_detection() {
        assert!(is_owner_repo_slug("torvalds/linux"));
        assert!(!is_owner_repo_slug("single"));
        assert!(!is_owner_repo_slug("a/b/c"));
        assert!(!is_owner_repo_slug("/leading"));
        assert!(!is_owner_repo_slug("trailing/"));
        assert!(!is_owner_repo_slug("https://github.com/o/r"));
    }

    #[test]
    fn clone_expands_owner_repo_slug() {
        let action = parse_cli_action(
            &argv(&["app.exe", "--cli-cwd=/w", "clone", "torvalds/linux"]),
            "/w",
        )
        .expect("action");
        assert_eq!(action["kind"], "clone-url");
        assert_eq!(action["url"], "https://github.com/torvalds/linux");
        assert!(action.get("branch").is_none());
    }

    #[test]
    fn clone_keeps_full_url_and_reads_branch() {
        let action = parse_cli_action(
            &argv(&[
                "app.exe",
                "--cli-cwd=/w",
                "clone",
                "-b",
                "main",
                "https://example.com/x.git",
            ]),
            "/w",
        )
        .expect("action");
        assert_eq!(action["kind"], "clone-url");
        assert_eq!(action["url"], "https://example.com/x.git");
        assert_eq!(action["branch"], "main");
    }

    #[test]
    fn clone_reads_branch_equals_form() {
        let action = parse_cli_action(
            &argv(&["app.exe", "--cli-cwd=/w", "clone", "--branch=dev", "o/r"]),
            "/w",
        )
        .expect("action");
        assert_eq!(action["branch"], "dev");
    }

    #[test]
    fn open_is_default_kind() {
        let action =
            parse_cli_action(&argv(&["app.exe", "--cli-cwd=/w"]), "/fallback").expect("action");
        assert_eq!(action["kind"], "open-repository");
        // The flag's cwd wins over the fallback.
        assert!(action["path"].as_str().unwrap().contains("w"));
    }

    #[cfg(windows)]
    #[test]
    fn resolves_absolute_path_arg() {
        let action = parse_cli_action(
            &argv(&["app.exe", "--cli-cwd=C:\\work", "open", "C:\\foo\\bar"]),
            "C:\\work",
        )
        .expect("action");
        assert_eq!(action["kind"], "open-repository");
        // Nonexistent path => canonicalize falls back to the absolute input.
        assert_eq!(action["path"], "C:\\foo\\bar");
    }

    #[cfg(windows)]
    #[test]
    fn strips_windows_verbatim_prefix() {
        assert_eq!(strip_verbatim(PathBuf::from(r"\\?\C:\dir")), r"C:\dir");
        // UNC verbatim is left intact.
        assert_eq!(
            strip_verbatim(PathBuf::from(r"\\?\UNC\server\share")),
            r"\\?\UNC\server\share"
        );
    }

    #[cfg(unix)]
    #[test]
    fn resolves_absolute_path_arg() {
        let action = parse_cli_action(
            &argv(&["app", "--cli-cwd=/work", "open", "/foo/bar"]),
            "/work",
        )
        .expect("action");
        assert_eq!(action["path"], "/foo/bar");
    }
}
