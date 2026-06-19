//! Desktop notifications. Mirrors notification channels in app/src/lib/ipc-shared.ts.
//!
//! The renderer's native notification contract (lib/notifications/show-notification.ts):
//! `show-notification` returns an id, the renderer stores the click callback under
//! that id, and a later `notification-event` ('click', id, userInfo) fires it. We
//! satisfy that contract here.
//!
//! On Windows we drive the native toast directly via tauri-winrt-notification so we
//! can deliver the click back (the notification plugin's desktop backend shows the
//! toast fire-and-forget and discards activation). On other desktops we fall back to
//! the plugin for display; click delivery there is best-effort.

use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::Value;
use tauri::AppHandle;

use crate::error::{AppError, AppResult};

/// Monotonic id source for notifications within a session. Matches the renderer's
/// string id keying (notification-handler.ts QuickLRU<string, ...>).
static NEXT_NOTIFICATION_ID: AtomicU64 = AtomicU64::new(1);

/// `show-notification` (RequestResponseChannels) — display a desktop notification.
/// Returns the id used to correlate a later click event, or null if it couldn't
/// be shown.
#[tauri::command]
pub fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
    user_info: Option<Value>,
) -> AppResult<Option<String>> {
    let id = NEXT_NOTIFICATION_ID
        .fetch_add(1, Ordering::Relaxed)
        .to_string();
    show_platform_notification(&app, &id, &title, &body, user_info)?;
    Ok(Some(id))
}

#[cfg(target_os = "windows")]
fn show_platform_notification(
    app: &AppHandle,
    id: &str,
    title: &str,
    body: &str,
    user_info: Option<Value>,
) -> AppResult<()> {
    use tauri::Emitter;
    use tauri_winrt_notification::Toast;

    // Installed builds register a Start Menu shortcut under the bundle identifier
    // (the AppUserModelID); in dev there's no such registration, so borrow the
    // PowerShell AUMID so the toast still appears.
    let app_id = if tauri::is_dev() {
        Toast::POWERSHELL_APP_ID.to_string()
    } else {
        app.config().identifier.clone()
    };

    let app_handle = app.clone();
    let id_for_click = id.to_string();

    Toast::new(&app_id)
        .title(title)
        .text1(body)
        .on_activated(move |_action| {
            // Mirror the upstream native module: ('click', id, userInfo).
            let _ = app_handle.emit(
                "notification-event",
                ("click", id_for_click.clone(), user_info.clone()),
            );
            Ok(())
        })
        .show()
        .map_err(|e| AppError::Internal(e.to_string()))
}

#[cfg(not(target_os = "windows"))]
fn show_platform_notification(
    app: &AppHandle,
    _id: &str,
    title: &str,
    body: &str,
    _user_info: Option<Value>,
) -> AppResult<()> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// `get-notifications-permission` (RequestResponseChannels) — current permission
/// state. Desktop platforms grant notifications to installed apps, so this is
/// always granted.
#[tauri::command]
pub fn get_notifications_permission() -> AppResult<String> {
    Ok("granted".to_string())
}

/// `request-notifications-permission` (RequestResponseChannels) — prompt for
/// permission. No prompt is needed on desktop; report success.
#[tauri::command]
pub fn request_notifications_permission() -> AppResult<bool> {
    Ok(true)
}
