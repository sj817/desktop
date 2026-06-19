//! Native theme. Mirrors theme channels in app/src/lib/ipc-shared.ts.

use tauri::{Theme, WebviewWindow};

use crate::error::{AppError, AppResult};

/// `should-use-dark-colors` — whether the window currently renders dark.
#[tauri::command]
pub fn should_use_dark_colors(window: WebviewWindow) -> AppResult<bool> {
    let theme = window.theme()?;
    Ok(matches!(theme, Theme::Dark))
}

/// `set-native-theme-source` — 'dark' | 'light' | 'system'.
#[tauri::command]
pub fn set_native_theme_source(window: WebviewWindow, theme_name: String) -> AppResult<()> {
    let theme = match theme_name.as_str() {
        "dark" => Some(Theme::Dark),
        "light" => Some(Theme::Light),
        "system" => None,
        other => return Err(AppError::InvalidInput(format!("unknown theme source: {other}"))),
    };
    window.set_theme(theme)?;
    Ok(())
}
