//! Git commands. Like the legacy app (which shells out to git via dugite in the
//! Node main process), these invoke the system `git` binary — cross-platform.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::ffi::OsString;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{mpsc, OnceLock, RwLock};
use std::thread;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult, blocking};
use crate::events::GIT_PROGRESS;

/// Result of a raw git invocation, mirroring dugite's IGitResult core fields.
///
/// `encoding` on the TS side controls whether the caller wants raw bytes
/// (base64) or a UTF-8 string. Since most callers want UTF-8, we offer both
/// representations and the TS shim picks the right one without decoding base64
/// client-side for the common case.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    /// When true, stdout/stderr are base64-encoded raw bytes (binary mode).
    /// When false, they are UTF-8 strings (lossy-converted).
    pub is_base64: bool,
}

/// On Windows, spawn git without allocating a console window.
#[cfg(windows)]
fn hide_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}
#[cfg(not(windows))]
fn hide_window(_cmd: &mut Command) {}

/// Custom git binary path (empty = use system PATH). Updated by
/// `set_custom_git_path` and read by `git_binary()`.
static GIT_BINARY: OnceLock<RwLock<String>> = OnceLock::new();

fn git_binary_lock() -> &'static RwLock<String> {
    GIT_BINARY.get_or_init(|| RwLock::new(String::new()))
}

/// Returns the git binary to use: custom path if set, otherwise "git" (from PATH).
pub fn git_binary() -> String {
    let custom = git_binary_lock().read().unwrap();
    if custom.is_empty() {
        "git".to_string()
    } else {
        custom.clone()
    }
}

/// Initialize the custom git binary from persisted config. Call once at setup.
pub fn init_git_binary(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Ok(dir) = app.path().app_config_dir() {
        let file = dir.join("git-path.txt");
        if let Ok(path) = std::fs::read_to_string(&file) {
            let path = path.trim().to_string();
            if !path.is_empty() && Path::new(&path).exists() {
                *git_binary_lock().write().unwrap() = path;
            }
        }
    }
}

/// Augmented PATH: app exe dir + custom git dir + system PATH.
fn build_augmented_path() -> OsString {
    static BASE_PATH: OnceLock<OsString> = OnceLock::new();
    let base = BASE_PATH.get_or_init(|| {
        let mut paths = Vec::new();
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                paths.push(dir.to_path_buf());
            }
        }
        if let Some(existing) = std::env::var_os("PATH") {
            paths.extend(std::env::split_paths(&existing));
        }
        std::env::join_paths(paths).unwrap_or_default()
    });

    let custom = git_binary_lock().read().unwrap();
    if custom.is_empty() {
        return base.clone();
    }
    if let Some(dir) = Path::new(custom.as_str()).parent() {
        let mut paths = vec![dir.to_path_buf()];
        paths.extend(std::env::split_paths(base));
        if let Ok(joined) = std::env::join_paths(paths) {
            return joined;
        }
    }
    base.clone()
}

/// Apply sensible default environment for git invocations.
fn apply_default_git_env(cmd: &mut Command) {
    hide_window(cmd);
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GIT_OPTIONAL_LOCKS", "0");
    cmd.env("PATH", build_augmented_path());
}

/// Apply caller-supplied environment overrides.
fn apply_user_env(cmd: &mut Command, env: Option<HashMap<String, Option<String>>>) {
    if let Some(vars) = env {
        for (key, value) in vars {
            match value {
                Some(v) => { cmd.env(key, v); }
                None => { cmd.env_remove(key); }
            }
        }
    }
}

fn build_result(stdout: Vec<u8>, stderr: Vec<u8>, exit_code: i32, binary: bool) -> GitExecResult {
    if binary {
        GitExecResult {
            stdout: STANDARD.encode(&stdout),
            stderr: STANDARD.encode(&stderr),
            exit_code,
            is_base64: true,
        }
    } else {
        GitExecResult {
            stdout: String::from_utf8(stdout)
                .unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned()),
            stderr: String::from_utf8(stderr)
                .unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned()),
            exit_code,
            is_base64: false,
        }
    }
}

/// Generic git executor. `binary` controls whether output is base64 (true) or
/// UTF-8 string (false). The TS shim sets this based on `encoding: 'buffer'`.
#[tauri::command]
pub async fn git_exec(
    repo_path: String,
    args: Vec<String>,
    stdin: Option<String>,
    env: Option<HashMap<String, Option<String>>>,
    binary: Option<bool>,
) -> AppResult<GitExecResult> {
    let want_binary = binary.unwrap_or(false);
    blocking(move || {
        let mut cmd = Command::new(&git_binary());
        cmd.args(&args).current_dir(&repo_path);
        apply_default_git_env(&mut cmd);
        apply_user_env(&mut cmd, env);

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn()?;

        if let Some(input) = stdin {
            if let Some(mut handle) = child.stdin.take() {
                let _ = handle.write_all(input.as_bytes());
            }
        }

        let output = child.wait_with_output()?;

        Ok(build_result(
            output.stdout,
            output.stderr,
            output.status.code().unwrap_or(-1),
            want_binary,
        ))
    })
    .await
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitProgressEvent {
    id: String,
    stream: &'static str,
    line: String,
}

/// Read from `reader` in chunks, splitting on \n and \r (git progress uses
/// bare \r for in-place updates), emitting a `git-progress` event per line.
/// Returns the collected raw bytes.
fn stream_lines<R: Read>(app: &AppHandle, id: &str, stream: &'static str, reader: R) -> Vec<u8> {
    let mut collected = Vec::with_capacity(4096);
    let mut line_buf = Vec::with_capacity(256);
    let mut reader = BufReader::with_capacity(8192, reader);

    // Pre-allocate the id string once for all events in this stream.
    let id_owned = id.to_string();

    loop {
        let chunk = match reader.fill_buf() {
            Ok(buf) if buf.is_empty() => break,
            Ok(buf) => buf.to_vec(),
            Err(_) => break,
        };
        let len = chunk.len();
        reader.consume(len);

        for &b in &chunk {
            collected.push(b);
            if b == b'\n' || b == b'\r' {
                if !line_buf.is_empty() {
                    let line = String::from_utf8_lossy(&line_buf).into_owned();
                    line_buf.clear();
                    let _ = app.emit(
                        GIT_PROGRESS,
                        GitProgressEvent {
                            id: id_owned.clone(),
                            stream,
                            line,
                        },
                    );
                }
            } else {
                line_buf.push(b);
            }
        }
    }

    // Trailing partial line (no terminator).
    if !line_buf.is_empty() {
        let line = String::from_utf8_lossy(&line_buf).into_owned();
        let _ = app.emit(
            GIT_PROGRESS,
            GitProgressEvent {
                id: id_owned,
                stream,
                line,
            },
        );
    }

    collected
}

/// Streaming variant of `git_exec`.
#[tauri::command]
pub async fn git_exec_streaming(
    app: AppHandle,
    id: String,
    repo_path: String,
    args: Vec<String>,
    stdin: Option<String>,
    env: Option<HashMap<String, Option<String>>>,
    binary: Option<bool>,
) -> AppResult<GitExecResult> {
    let want_binary = binary.unwrap_or(false);
    blocking(move || {
        let mut cmd = Command::new(&git_binary());
        cmd.args(&args).current_dir(&repo_path);
        apply_default_git_env(&mut cmd);
        apply_user_env(&mut cmd, env);

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn()?;

        if let Some(input) = stdin {
            if let Some(mut handle) = child.stdin.take() {
                let _ = handle.write_all(input.as_bytes());
            }
        }
        drop(child.stdin.take());

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let (tx, rx) = mpsc::channel::<(&'static str, Vec<u8>)>();

        if let Some(out) = stdout {
            let app = app.clone();
            let id = id.clone();
            let tx = tx.clone();
            thread::spawn(move || {
                let bytes = stream_lines(&app, &id, "stdout", out);
                let _ = tx.send(("stdout", bytes));
            });
        } else {
            let _ = tx.send(("stdout", Vec::new()));
        }

        if let Some(err) = stderr {
            let app = app.clone();
            let id = id.clone();
            let tx = tx.clone();
            thread::spawn(move || {
                let bytes = stream_lines(&app, &id, "stderr", err);
                let _ = tx.send(("stderr", bytes));
            });
        } else {
            let _ = tx.send(("stderr", Vec::new()));
        }
        drop(tx);

        let mut stdout_bytes = Vec::new();
        let mut stderr_bytes = Vec::new();
        for (which, bytes) in rx {
            match which {
                "stdout" => stdout_bytes = bytes,
                "stderr" => stderr_bytes = bytes,
                _ => {}
            }
        }

        let status = child.wait()?;

        Ok(build_result(
            stdout_bytes,
            stderr_bytes,
            status.code().unwrap_or(-1),
            want_binary,
        ))
    })
    .await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusEntry {
    pub status: String,
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub sha: String,
    pub short_sha: String,
    pub summary: String,
    pub author: String,
    pub date: String,
}

#[tauri::command]
pub async fn git_version() -> AppResult<String> {
    blocking(|| {
        let mut cmd = Command::new(&git_binary());
        cmd.arg("--version");
        apply_default_git_env(&mut cmd);
        let output = cmd.output()?;
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(AppError::Git(
                String::from_utf8_lossy(&output.stderr).trim().to_string(),
            ))
        }
    })
    .await
}

#[tauri::command]
pub async fn is_git_repository(path: String) -> AppResult<bool> {
    blocking(move || Ok(crate::git2_ops::is_git_repo(&path))).await
}

#[tauri::command]
pub async fn current_branch(path: String) -> AppResult<String> {
    blocking(move || crate::git2_ops::current_branch(&path)).await
}

#[tauri::command]
pub async fn local_branches(path: String) -> AppResult<Vec<String>> {
    blocking(move || crate::git2_ops::local_branches(&path)).await
}

#[tauri::command]
pub async fn status_entries(path: String) -> AppResult<Vec<StatusEntry>> {
    blocking(move || {
        let raw = crate::git2_ops::status_entries(&path)?;
        Ok(raw
            .into_iter()
            .map(|(status, path)| StatusEntry { status, path })
            .collect())
    })
    .await
}

#[tauri::command]
pub async fn recent_commits(path: String, limit: u32) -> AppResult<Vec<CommitInfo>> {
    blocking(move || {
        let raw = crate::git2_ops::recent_commits(&path, limit as usize)?;
        Ok(raw
            .into_iter()
            .map(|c| CommitInfo {
                sha: c.sha,
                short_sha: c.short_sha,
                summary: c.summary,
                author: c.author,
                date: c.date,
            })
            .collect())
    })
    .await
}

/// Resolve the full path of the git binary currently in use.
#[tauri::command]
pub async fn resolve_git_path() -> AppResult<String> {
    blocking(|| {
        let bin = git_binary();
        if bin != "git" {
            return if Path::new(&bin).exists() {
                Ok(bin)
            } else {
                Err(AppError::InvalidInput(format!(
                    "Custom git path does not exist: {bin}"
                )))
            };
        }
        #[cfg(windows)]
        {
            let mut cmd = Command::new("where.exe");
            cmd.arg("git");
            hide_window(&mut cmd);
            let output = cmd.output()?;
            if output.status.success() {
                if let Some(line) = String::from_utf8_lossy(&output.stdout).lines().next() {
                    return Ok(line.trim().to_string());
                }
            }
            Err(AppError::Git("git not found on PATH".into()))
        }
        #[cfg(not(windows))]
        {
            let output = Command::new("which").arg("git").output()?;
            if output.status.success() {
                return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
            }
            Err(AppError::Git("git not found on PATH".into()))
        }
    })
    .await
}

/// Set or clear the custom git binary path. Persists to app config dir.
#[tauri::command]
pub async fn set_custom_git_path(
    app: tauri::AppHandle,
    path: Option<String>,
) -> AppResult<()> {
    use tauri::Manager;
    blocking(move || {
        let config_dir = app.path().app_config_dir()?;
        std::fs::create_dir_all(&config_dir)?;
        let file = config_dir.join("git-path.txt");

        match path {
            Some(p) if !p.is_empty() => {
                if !Path::new(&p).exists() {
                    return Err(AppError::InvalidInput(format!(
                        "Path does not exist: {p}"
                    )));
                }
                std::fs::write(&file, &p)?;
                *git_binary_lock().write().unwrap() = p;
            }
            _ => {
                let _ = std::fs::remove_file(&file);
                *git_binary_lock().write().unwrap() = String::new();
            }
        }
        Ok(())
    })
    .await
}

/// Returns the augmented PATH (for shell launching). Exposed so shell.rs can use it.
pub fn augmented_path() -> OsString {
    build_augmented_path()
}
