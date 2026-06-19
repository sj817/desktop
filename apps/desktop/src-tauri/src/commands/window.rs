//! Window control & state. Mirrors window channels in app/src/lib/ipc-shared.ts.
//! Implemented with Tauri's cross-platform window API.

use tauri::{AppHandle, Emitter, WebviewWindow};

use crate::error::AppResult;
use crate::events;

/// Compute the renderer-facing window state string for a window, using the same
/// precedence as the official `lib/window-state.ts` `getWindowState`:
/// full-screen > maximized > minimized > hidden > normal. Returns one of
/// `"minimized" | "normal" | "maximized" | "full-screen" | "hidden"`.
pub fn compute_window_state(window: &WebviewWindow) -> &'static str {
    if window.is_fullscreen().unwrap_or(false) {
        "full-screen"
    } else if window.is_maximized().unwrap_or(false) {
        "maximized"
    } else if window.is_minimized().unwrap_or(false) {
        "minimized"
    } else if !window.is_visible().unwrap_or(true) {
        "hidden"
    } else {
        "normal"
    }
}

/// `minimize-window`
#[tauri::command]
pub fn minimize_window(window: WebviewWindow) -> AppResult<()> {
    window.minimize()?;
    Ok(())
}

/// `maximize-window`
#[tauri::command]
pub fn maximize_window(window: WebviewWindow) -> AppResult<()> {
    window.maximize()?;
    Ok(())
}

/// `unmaximize-window`
#[tauri::command]
pub fn unmaximize_window(window: WebviewWindow) -> AppResult<()> {
    window.unmaximize()?;
    Ok(())
}

/// `close-window`
#[tauri::command]
pub fn close_window(window: WebviewWindow) -> AppResult<()> {
    window.close()?;
    Ok(())
}

/// `focus-window`
#[tauri::command]
pub fn focus_window(window: WebviewWindow) -> AppResult<()> {
    window.set_focus()?;
    Ok(())
}

/// `quit-app`
#[tauri::command]
pub fn quit_app(app: AppHandle) -> AppResult<()> {
    app.exit(0);
    Ok(())
}

/// `is-window-focused`
#[tauri::command]
pub fn is_window_focused(window: WebviewWindow) -> AppResult<bool> {
    Ok(window.is_focused()?)
}

/// `is-window-maximized`
#[tauri::command]
pub fn is_window_maximized(window: WebviewWindow) -> AppResult<bool> {
    Ok(window.is_maximized()?)
}

/// `get-current-window-state` — full-screen / maximized / minimized / hidden /
/// normal, matching the renderer's `WindowState` union and `getWindowState`
/// precedence in the official `lib/window-state.ts`.
#[tauri::command]
pub fn get_current_window_state(window: WebviewWindow) -> AppResult<Option<String>> {
    Ok(Some(compute_window_state(&window).to_string()))
}

/// `get-current-window-zoom-factor` — not tracked natively; UI uses its default.
#[tauri::command]
pub fn get_current_window_zoom_factor() -> AppResult<Option<f64>> {
    Ok(None)
}

/// `set-window-zoom-factor`
///
/// Applies the webview zoom and then echoes the new factor back to the renderer
/// over the `zoom-factor-changed` channel (bare number payload), mirroring the
/// official main process which emits that event whenever the zoom changes.
#[tauri::command]
pub fn set_window_zoom_factor(window: WebviewWindow, zoom_factor: f64) -> AppResult<()> {
    window.set_zoom(zoom_factor)?;
    // Renderer subscribes via ipcRenderer.on('zoom-factor-changed', (_, n) => ...);
    // the shim delivers the payload as the listener's 2nd arg, so emit a bare f64.
    let _ = window.emit(events::ZOOM_FACTOR_CHANGED, zoom_factor);
    Ok(())
}

/// `toggle-dev-tools` — open or close the webview devtools.
#[tauri::command]
pub fn toggle_dev_tools(window: WebviewWindow) -> AppResult<()> {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
    Ok(())
}

/// `update-window-background-color` — refined later.
#[tauri::command]
pub fn update_window_background_color(color: String) -> AppResult<()> {
    let _ = color;
    Ok(())
}
