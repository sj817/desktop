//! Native contextual (right-click) menus.
//!
//! The official renderer (lib/menu-item.ts) serializes a menu template (label /
//! type / checked / enabled / role / submenu, minus the action callbacks) and
//! calls `show-contextual-menu`, expecting back the index PATH of the clicked
//! item (e.g. [1, 0] for the first item of the second item's submenu) so it can
//! walk its ORIGINAL items array and run that item's action. null = dismissed.
//!
//! Tauri v2 has no blocking popup and no "menu dismissed" event, so we:
//!   1. build a native `Menu` whose every clickable item has the id
//!      "<request_id>:<dotted index path>" (e.g. "7:1.0"),
//!   2. pop it at the cursor (non-blocking) and keep it alive in managed state,
//!   3. on the global `on_menu_event`, parse the id and emit
//!      `contextual-menu-result-<request_id>` with the path as a number[].
//! Dismissal is inferred renderer-side (see apps/desktop/src/shims/electron.ts).

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde_json::Value;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};

use crate::error::{AppError, AppResult};
use crate::events::CONTEXTUAL_MENU_RESULT_PREFIX;

/// Holds the next request id and the popped menus, kept alive until their result
/// event fires (popup_menu is non-blocking, so the Menu must outlive the call).
#[derive(Default)]
pub struct ContextMenuState {
    next_id: AtomicU64,
    menus: Mutex<HashMap<u64, Menu<tauri::Wry>>>,
}

fn join_path(path: &[usize]) -> String {
    path.iter()
        .map(usize::to_string)
        .collect::<Vec<_>>()
        .join(".")
}

/// Builds the menu items for one level of the template, numbering each item by
/// its SOURCE index so the returned path matches the renderer's original array.
fn build_items<R: Runtime, M: Manager<R>>(
    manager: &M,
    request_id: u64,
    prefix: &[usize],
    items: &[Value],
) -> AppResult<Vec<Box<dyn IsMenuItem<R>>>> {
    let mut out: Vec<Box<dyn IsMenuItem<R>>> = Vec::new();

    for (idx, item) in items.iter().enumerate() {
        let item_type = item.get("type").and_then(Value::as_str);
        let role = item.get("role").and_then(Value::as_str);

        if item_type == Some("separator") {
            out.push(Box::new(
                PredefinedMenuItem::separator(manager)?,
            ));
            continue;
        }

        // role: 'editMenu' expands in place to the platform edit items. These
        // are native/predefined (clipboard ops on the focused control) and do
        // NOT carry an index path; the renderer never gets a result for them.
        if role
            .map(|r| r.eq_ignore_ascii_case("editMenu"))
            .unwrap_or(false)
        {
            out.push(Box::new(
                PredefinedMenuItem::undo(manager, None)?,
            ));
            out.push(Box::new(
                PredefinedMenuItem::redo(manager, None)?,
            ));
            out.push(Box::new(
                PredefinedMenuItem::separator(manager)?,
            ));
            out.push(Box::new(
                PredefinedMenuItem::cut(manager, None)?,
            ));
            out.push(Box::new(
                PredefinedMenuItem::copy(manager, None)?,
            ));
            out.push(Box::new(
                PredefinedMenuItem::paste(manager, None)?,
            ));
            out.push(Box::new(
                PredefinedMenuItem::separator(manager)?,
            ));
            out.push(Box::new(
                PredefinedMenuItem::select_all(manager, None)?,
            ));
            continue;
        }

        let label = item.get("label").and_then(Value::as_str).unwrap_or("");
        let enabled = item.get("enabled").and_then(Value::as_bool).unwrap_or(true);

        let mut path = prefix.to_vec();
        path.push(idx);
        let id = format!("{}:{}", request_id, join_path(&path));

        if let Some(sub_items) = item.get("submenu").and_then(Value::as_array) {
            let submenu =
                Submenu::with_id(manager, id, label, enabled)?;
            for child in build_items(manager, request_id, &path, sub_items)? {
                submenu.append(child.as_ref())?;
            }
            out.push(Box::new(submenu));
            continue;
        }

        if item_type == Some("checkbox") {
            let checked = item
                .get("checked")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            out.push(Box::new(
                CheckMenuItem::with_id(manager, id, label, enabled, checked, None::<&str>)?,
            ));
            continue;
        }

        out.push(Box::new(
            MenuItem::with_id(manager, id, label, enabled, None::<&str>)?,
        ));
    }

    Ok(out)
}

/// Builds and pops the native contextual menu, returning the request id. The
/// selected index path is delivered later via `contextual-menu-result-<id>`.
pub fn show_contextual_menu(
    window: &WebviewWindow,
    state: &ContextMenuState,
    items: &Value,
) -> AppResult<u64> {
    let item_values = items
        .as_array()
        .ok_or(AppError::InvalidInput("contextual menu items must be an array".into()))?;
    let request_id = state.next_id.fetch_add(1, Ordering::SeqCst);

    let menu = Menu::new(window)?;
    for item in build_items(window, request_id, &[], item_values)? {
        menu.append(item.as_ref())?;
    }

    window.popup_menu(&menu)?;

    // Keep this menu alive until its result fires; only one context menu is open
    // at a time, so drop any previous (e.g. dismissed) ones now.
    if let Ok(mut menus) = state.menus.lock() {
        menus.clear();
        menus.insert(request_id, menu);
    }

    Ok(request_id)
}

/// Registers the global menu-event handler that turns a clicked contextual-menu
/// item's id ("<request_id>:<dotted path>") into a
/// `contextual-menu-result-<request_id>` event carrying the index path. Ignores
/// ids that aren't for a live contextual menu (e.g. a future app menu bar).
pub fn register_menu_event_handler(app: &AppHandle) {
    app.on_menu_event(|app, event| {
        let id = event.id().0.as_str();
        let Some((rid, path)) = id.split_once(':') else {
            return;
        };
        let Ok(request_id) = rid.parse::<u64>() else {
            return;
        };

        // Only handle (and consume) ids belonging to a live contextual menu.
        let state = app.state::<ContextMenuState>();
        let known = match state.menus.lock() {
            Ok(mut menus) => menus.remove(&request_id).is_some(),
            Err(_) => false,
        };
        if !known {
            return;
        }

        let indices: Vec<u32> = path
            .split('.')
            .filter_map(|s| s.parse::<u32>().ok())
            .collect();
        let _ = app.emit(
            &format!("{}{}", CONTEXTUAL_MENU_RESULT_PREFIX, request_id),
            indices,
        );
    });
}
