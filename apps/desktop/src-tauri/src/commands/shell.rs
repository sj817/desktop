//! Native shell integration. Uses tauri-plugin-opener for correct cross-platform
//! open/reveal (ShellExecute on Windows, `open` on macOS, xdg/dbus on Linux) and
//! the `trash` crate for moving to the OS trash. This avoids hand-rolled shell
//! quoting bugs (paths with spaces, URLs with `&`, etc.).

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::error::{blocking, AppError, AppResult};

// All async + run on a blocking task: moving a large directory to the trash, and
// launching the OS file manager / default handler, both block until the operation
// (or process launch) completes — on the main thread that would freeze the UI.

/// `move-to-trash` — move a path to the OS trash (cross-platform).
#[tauri::command]
pub async fn move_to_trash(path: String) -> AppResult<()> {
    blocking(move || trash::delete(&path).map_err(|e| AppError::Trash(e.to_string()))).await
}

/// `show-item-in-folder` — reveal a path in the OS file manager.
#[tauri::command]
pub async fn show_item_in_folder(app: AppHandle, path: String) -> AppResult<()> {
    blocking(move || {
        app.opener()
            .reveal_item_in_dir(path)
            .map_err(|e| AppError::Internal(e.to_string()))
    })
    .await
}

/// `open-external` — open a URL or path with the default handler.
#[tauri::command]
pub async fn open_external(app: AppHandle, path: String) -> AppResult<bool> {
    blocking(move || -> AppResult<bool> {
        app.opener()
            .open_url(path, None::<&str>)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(true)
    })
    .await
}

/// `launch-process` — spawn a detached process with arguments. Used by the
/// renderer to launch external editors and shells (which the official Electron
/// app did via Node's child_process.spawn, unavailable in a Tauri webview).
#[tauri::command]
pub async fn launch_process(
    cmd: String,
    args: Vec<String>,
    cwd: Option<String>,
    use_shell: Option<bool>,
) -> AppResult<()> {
    blocking(move || {
        let shell_mode = use_shell.unwrap_or(false);

        #[cfg(windows)]
        let mut command = if shell_mode {
            use std::os::windows::process::CommandExt;
            let full_cmd = std::iter::once(cmd)
                .chain(args)
                .collect::<Vec<_>>()
                .join(" ");
            let mut c = std::process::Command::new("cmd.exe");
            c.raw_arg(format!("/C {full_cmd}"));
            c
        } else {
            let mut c = std::process::Command::new(&cmd);
            c.args(&args);
            c
        };

        #[cfg(not(windows))]
        let mut command = if shell_mode {
            let mut c = std::process::Command::new("/bin/sh");
            let full = std::iter::once(cmd).chain(args).collect::<Vec<_>>().join(" ");
            c.args(["-c", &full]);
            c
        } else {
            let mut c = std::process::Command::new(&cmd);
            c.args(&args);
            c
        };

        if let Some(dir) = &cwd {
            command.current_dir(dir);
        }
        command.stdin(std::process::Stdio::null());
        command.stdout(std::process::Stdio::null());
        command.stderr(std::process::Stdio::null());
        command.env("PATH", crate::commands::git::augmented_path());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            if shell_mode {
                const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
                command.creation_flags(CREATE_NEW_CONSOLE);
            } else {
                const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                const DETACHED_PROCESS: u32 = 0x0000_0008;
                command.creation_flags(DETACHED_PROCESS | CREATE_NO_WINDOW);
            }
        }

        let _child = command.spawn()?;
        Ok(())
    })
    .await
}

/// `unsafe-open-directory` — open a directory in the file manager.
#[tauri::command]
pub async fn unsafe_open_directory(app: AppHandle, path: String) -> AppResult<()> {
    blocking(move || {
        app.opener()
            .open_path(path, None::<&str>)
            .map_err(|e| AppError::Internal(e.to_string()))
    })
    .await
}
