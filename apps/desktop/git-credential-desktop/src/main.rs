//! `git-credential-desktop` — the git credential helper for GitHub Desktop Next.
//!
//! git invokes it as `git-credential-desktop <operation>` (get | store | erase)
//! with the credential description on stdin. It forwards the request to the
//! running app's trampoline server (src-tauri/src/commands/trampoline.rs) over a
//! local socket whose port + token git passes via DESKTOP_PORT /
//! DESKTOP_TRAMPOLINE_TOKEN, and prints the server's reply back to git. If the app
//! isn't reachable (or the env is missing) it exits silently so git falls through
//! to the next configured helper.

use std::io::{Read, Write};
use std::net::TcpStream;

fn main() {
    let operation = std::env::args().nth(1).unwrap_or_default();

    let (Ok(port), Ok(token)) = (
        std::env::var("DESKTOP_PORT"),
        std::env::var("DESKTOP_TRAMPOLINE_TOKEN"),
    ) else {
        return;
    };
    let Ok(port) = port.parse::<u16>() else {
        return;
    };

    let mut stdin = String::new();
    let _ = std::io::stdin().read_to_string(&mut stdin);

    let request = serde_json::json!({
        "token": token,
        "identifier": "CREDENTIALHELPER",
        "parameters": [operation],
        "stdin": stdin,
        "env": {},
    })
    .to_string();

    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) else {
        return;
    };
    if stream.write_all(request.as_bytes()).is_err()
        || stream.write_all(b"\n").is_err()
        || stream.flush().is_err()
    {
        return;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_ok() {
        let _ = std::io::stdout().write_all(response.as_bytes());
    }
}
