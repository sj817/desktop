//! Application menu. Mirrors menu channels in app/src/lib/ipc-shared.ts.

use serde_json::Value;

use crate::error::{AppError, AppResult};

/// `get-app-menu` (RequestResponseChannels) — retrieve the application menu.
#[tauri::command]
pub fn get_app_menu() -> AppResult<()> {
    Err(AppError::Internal("not implemented".into()))
}

/// `execute-menu-item-by-id` (RequestResponseChannels) — execute a menu item by its identifier.
#[tauri::command]
pub fn execute_menu_item_by_id(id: String) -> AppResult<()> {
    Err(AppError::Internal("not implemented".into()))
}

/// `update-menu-state` (RequestResponseChannels) — update the enabled/checked state of menu items.
#[tauri::command]
pub fn update_menu_state(state: Value) -> AppResult<()> {
    Err(AppError::Internal("not implemented".into()))
}

/// `update-preferred-app-menu-item-labels` (RequestResponseChannels) — update preferred menu item labels.
#[tauri::command]
pub fn update_preferred_app_menu_item_labels(labels: Value) -> AppResult<()> {
    Err(AppError::Internal("not implemented".into()))
}

/// `select-all-window-contents` (RequestResponseChannels) — select all contents in the focused window.
#[tauri::command]
pub fn select_all_window_contents() -> AppResult<()> {
    Err(AppError::Internal("not implemented".into()))
}
