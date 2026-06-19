//! Auto-updater & CLI install. Mirrors update channels in app/src/lib/ipc-shared.ts.

use crate::error::{AppError, AppResult};

/// `check-for-updates` (Error|undefined -> Err on failure) — trigger an update check against the given feed URL.
#[tauri::command]
pub fn check_for_updates(url: String) -> AppResult<()> {
    Err(AppError::Internal("not implemented".into()))
}

/// `quit-and-install-updates` — quit the app and install the downloaded update.
#[tauri::command]
pub fn quit_and_install_updates() -> AppResult<()> {
    Err(AppError::Internal("not implemented".into()))
}

/// `show-installing-update` — display the installing-update UI.
#[tauri::command]
pub fn show_installing_update() -> AppResult<()> {
    Err(AppError::Internal("not implemented".into()))
}

// The Windows CLI install/uninstall commands live in `commands::cli`.
