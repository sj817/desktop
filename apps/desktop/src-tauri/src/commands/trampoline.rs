//! Native credential trampoline — the faithful replacement for desktop-trampoline
//! + the Node `trampoline-server` (which can't listen from inside the webview).
//!
//! Flow: git invokes the `git-credential-desktop` helper binary (see
//! src/bin/git-credential-desktop.rs) as its credential helper. The helper
//! connects to this local TCP server (port + token handed to git via
//! DESKTOP_PORT / DESKTOP_TRAMPOLINE_TOKEN), forwarding the git credential
//! operation. We bridge that to the renderer's existing, account-aware trampoline
//! handlers (createCredentialHelperTrampolineHandler) over a Tauri event and send
//! their reply back to the helper, which prints it to git on stdout.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use tokio::net::TcpListener as TokioTcpListener;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

/// Shared state: the session token the helper must present, the bound port, and
/// the registry of in-flight requests awaiting a renderer response.
pub struct TrampolineState {
    token: String,
    port: Mutex<u16>,
    pending: Mutex<HashMap<u64, tokio::sync::oneshot::Sender<String>>>,
    next_id: AtomicU64,
}

impl Default for TrampolineState {
    fn default() -> Self {
        // localhost-only session secret; uniqueness from pid + time is enough.
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        Self {
            token: format!("{:x}{:x}", std::process::id(), nanos),
            port: Mutex::new(0),
            pending: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
        }
    }
}

#[derive(Deserialize)]
struct HelperRequest {
    token: String,
    identifier: String,
    #[serde(default)]
    parameters: Vec<String>,
    #[serde(default)]
    stdin: String,
    #[serde(default)]
    env: HashMap<String, String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TrampolineCommandEvent {
    id: u64,
    identifier: String,
    parameters: Vec<String>,
    stdin: String,
    environment_variables: HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrampolineConfig {
    pub port: u16,
    pub token: String,
    pub helper_path: String,
}

/// Absolute path to the `git-credential-desktop` helper, which cargo/tauri build
/// places next to the main executable.
fn helper_path() -> String {
    let name = if cfg!(windows) {
        "git-credential-desktop.exe"
    } else {
        "git-credential-desktop"
    };
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join(name)))
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| name.to_string())
}

/// Start the trampoline TCP server (call once from setup). Binds 127.0.0.1:0 and
/// records the port in the managed state.
pub fn start(app: &AppHandle) {
    let listener = match std::net::TcpListener::bind(("127.0.0.1", 0)) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[trampoline] failed to bind: {e}");
            return;
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    if let Some(state) = app.try_state::<TrampolineState>() {
        *state.port.lock().unwrap() = port;
    }

    listener.set_nonblocking(true).expect("set_nonblocking");

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let tokio_listener = TokioTcpListener::from_std(listener).expect("from_std");
        loop {
            if let Ok((stream, _)) = tokio_listener.accept().await {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    handle_connection(&app, stream).await;
                });
            }
        }
    });
}

async fn handle_connection(app: &AppHandle, stream: tokio::net::TcpStream) {
    let (reader_half, mut writer_half) = stream.into_split();
    let mut reader = tokio::io::BufReader::new(reader_half);
    let mut line = String::new();
    if reader.read_line(&mut line).await.is_err() {
        return;
    }

    let request: HelperRequest = match serde_json::from_str(line.trim_end()) {
        Ok(req) => req,
        Err(_) => return,
    };

    let Some(state) = app.try_state::<TrampolineState>() else {
        return;
    };
    if request.token != state.token {
        return;
    }

    let id = state.next_id.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    state.pending.lock().unwrap().insert(id, tx);

    let _ = app.emit(
        "trampoline-command",
        TrampolineCommandEvent {
            id,
            identifier: request.identifier,
            parameters: request.parameters,
            stdin: request.stdin,
            environment_variables: request.env,
        },
    );

    // The renderer handler may prompt the user (e.g. sign-in), so allow time.
    let output = tokio::time::timeout(Duration::from_secs(300), rx)
        .await
        .ok()
        .and_then(|r| r.ok())
        .unwrap_or_default();

    let _ = writer_half.write_all(output.as_bytes()).await;
    let _ = writer_half.flush().await;
}

/// `trampoline_config` — port, session token, and helper path for the renderer to
/// wire into the git environment.
#[tauri::command]
pub fn trampoline_config(state: tauri::State<'_, TrampolineState>) -> TrampolineConfig {
    TrampolineConfig {
        port: *state.port.lock().unwrap(),
        token: state.token.clone(),
        helper_path: helper_path(),
    }
}

/// `trampoline_response` — the renderer's reply for an in-flight command, sent
/// back to the waiting helper connection.
#[tauri::command]
pub fn trampoline_response(state: tauri::State<'_, TrampolineState>, id: u64, output: String) {
    if let Some(tx) = state.pending.lock().unwrap().remove(&id) {
        let _ = tx.send(output);
    }
}
