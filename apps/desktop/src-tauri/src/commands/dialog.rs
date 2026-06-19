//! Native dialogs & contextual menu. Mirrors dialog channels in app/src/lib/ipc-shared.ts.

use std::path::Path;

use serde::Deserialize;
use serde_json::Value;
use tauri_plugin_dialog::{DialogExt, FilePath};

use crate::error::{AppResult, blocking};

/// Subset of Electron's `FileFilter` ({ name, extensions }).
#[derive(Deserialize, Default)]
pub struct FileFilter {
    #[serde(default)]
    name: String,
    #[serde(default)]
    extensions: Vec<String>,
}

/// Subset of Electron's `OpenDialogOptions` / `SaveDialogOptions` that the
/// renderer actually passes (see clone-repository.tsx, add-existing-repository.tsx,
/// repository-path.tsx, custom-integration-form.tsx). Fields we don't support on
/// the cross-platform dialog backend (showsTagField, nameFieldLabel, message) are
/// accepted-and-ignored for contract parity.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DialogOptions {
    /// Electron flags such as "openDirectory", "openFile", "createDirectory".
    properties: Vec<String>,
    filters: Vec<FileFilter>,
    default_path: Option<String>,
    title: Option<String>,
    button_label: Option<String>,
}

/// Turn the picked `FilePath` into the absolute path string the renderer expects,
/// or `None` when the dialog was cancelled.
fn file_path_to_string(picked: Option<FilePath>) -> Option<String> {
    picked
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}

/// Apply `defaultPath` to a dialog builder. Electron lets `defaultPath` be either
/// a directory (start there) or a full path (start in its parent, pre-fill name).
/// We detect an existing directory and otherwise split parent/file name.
fn apply_default_path<R: tauri::Runtime>(
    mut builder: tauri_plugin_dialog::FileDialogBuilder<R>,
    default_path: &Option<String>,
    is_save: bool,
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    let Some(raw) = default_path else {
        return builder;
    };
    if raw.is_empty() {
        return builder;
    }

    let path = Path::new(raw);
    if path.is_dir() {
        builder = builder.set_directory(path);
    } else {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                builder = builder.set_directory(parent);
            }
        }
        if is_save {
            if let Some(name) = path.file_name() {
                builder = builder.set_file_name(name.to_string_lossy());
            }
        }
    }
    builder
}

/// Build a `FileDialogBuilder` from the shared option fields (filters, title,
/// button label, default path).
fn build_dialog<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    options: &DialogOptions,
    is_save: bool,
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    let mut builder = app.dialog().file();

    for filter in &options.filters {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(&filter.name, &extensions);
    }

    if let Some(title) = &options.title {
        builder = builder.set_title(title);
    }

    if options.properties.iter().any(|p| p == "createDirectory") {
        builder = builder.set_can_create_directories(true);
    }

    // `buttonLabel` has no cross-platform setter; accepted for contract parity.
    let _ = &options.button_label;

    apply_default_path(builder, &options.default_path, is_save)
}

/// `show-save-dialog` (Electron.SaveDialogOptions) — native save dialog. Returns
/// the chosen absolute path, or `null` when cancelled.
#[tauri::command]
pub async fn show_save_dialog(
    app: tauri::AppHandle,
    options: DialogOptions,
) -> AppResult<Option<String>> {
    // Dialogs must not block the main thread (deadlock); run on a blocking task.
    blocking(move || {
        let builder = build_dialog(&app, &options, true);
        Ok(file_path_to_string(builder.blocking_save_file()))
    })
    .await
}

/// `show-open-dialog` (Electron.OpenDialogOptions) — native open dialog. Picks a
/// directory when `properties` contains "openDirectory", otherwise a file.
/// Returns the chosen absolute path, or `null` when cancelled.
#[tauri::command]
pub async fn show_open_dialog(
    app: tauri::AppHandle,
    options: DialogOptions,
) -> AppResult<Option<String>> {
    let open_directory = options.properties.iter().any(|p| p == "openDirectory");

    blocking(move || {
        let builder = build_dialog(&app, &options, false);
        let picked = if open_directory {
            builder.blocking_pick_folder()
        } else {
            builder.blocking_pick_file()
        };
        Ok(file_path_to_string(picked))
    })
    .await
}

/// `show-contextual-menu` — native contextual (right-click) menu.
///
/// Builds a native menu from the serialized renderer template, pops it at the
/// cursor (non-blocking), and returns a `request_id`. The selected index PATH is
/// delivered later as the Tauri event `contextual-menu-result-<request_id>` with
/// a `number[]` payload (see `ContextMenuState` / the global `on_menu_event`
/// handler wired in `lib.rs`). The renderer (`lib/menu-item.ts`) awaits that
/// event and walks the path to find the clicked item's action.
#[tauri::command]
pub fn show_contextual_menu(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, crate::contextual_menu::ContextMenuState>,
    items: Value,
    add_spell_check_menu: bool,
) -> AppResult<u64> {
    // Spell-check menu items are not wired yet; accept the flag for contract parity.
    let _ = add_spell_check_menu;
    crate::contextual_menu::show_contextual_menu(&window, &state, &items)
}

/// `show-certificate-trust-dialog` — prompt to trust a certificate. Tauri uses
/// the system certificate store, so there is no app-level trust prompt to show;
/// this is a no-op for contract parity with the Electron channel.
#[tauri::command]
pub fn show_certificate_trust_dialog(certificate: Value, message: String) -> AppResult<()> {
    let _ = (certificate, message);
    Ok(())
}
