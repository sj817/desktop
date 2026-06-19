mod commands;
mod contextual_menu;
pub mod error;
mod events;
mod git2_ops;

use tauri::{Emitter, Listener, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance must be the FIRST plugin registered (Tauri requirement).
    // A second `github <path>` launch is forwarded here instead of opening a new
    // window; we focus the existing window and dispatch the CLI action.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            commands::cli::handle_second_instance(app, argv, cwd);
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(contextual_menu::ContextMenuState::default())
        .manage(commands::cli::PendingCliAction::default())
        .manage(commands::trampoline::TrampolineState::default())
        // Mirror upstream's main-process window events (app-window.ts): emit
        // 'focus'/'blur' and 'window-state-changed' so the renderer reacts to
        // focus and maximize/minimize/restore/full-screen.
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::Focused(focused) => {
                let name = if *focused {
                    events::FOCUS
                } else {
                    events::BLUR
                };
                let _ = window.emit(name, ());
            }
            // Tauri v2 has no maximize/minimize/restore/full-screen events; a
            // Resized fires on all of those transitions, so recompute the
            // WindowState string (same precedence as lib/window-state.ts) and
            // push it over 'window-state-changed'.
            tauri::WindowEvent::Resized(_) => {
                let state = if window.is_fullscreen().unwrap_or(false) {
                    "full-screen"
                } else if window.is_maximized().unwrap_or(false) {
                    "maximized"
                } else if window.is_minimized().unwrap_or(false) {
                    "minimized"
                } else if !window.is_visible().unwrap_or(true) {
                    "hidden"
                } else {
                    "normal"
                };
                let _ = window.emit(events::WINDOW_STATE_CHANGED, state);
            }
            _ => {}
        })
        // Global menu-event handler for native contextual menus (see
        // contextual_menu.rs). This is the ONE setup closure — concatenate any
        // future setup bodies here.
        .setup(|app| {
            // WebView2 (and WKWebView) persist the webview zoom factor in their
            // profile, so an accidental Ctrl+scroll / Ctrl+± / pinch during use
            // sticks across restarts and rescales the whole UI vs. official.
            // Upstream pins zoom in the Electron main process via
            // setVisualZoomLevelLimits(1, 1) (app-window.ts) — that code never
            // runs under Tauri, so reset the zoom to 1.0 on every launch. The
            // renderer still drives explicit zoom via set_window_zoom_factor.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_zoom(1.0);
            }
            contextual_menu::register_menu_event_handler(app.handle());

            // Deep-link handler: forward OAuth callback URLs to the renderer
            // as 'url-action' events (mirrors official Electron main process).
            let deep_link_app = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                let payload = event.payload();
                if let Ok(arr) = serde_json::from_str::<Vec<String>>(payload) {
                    for url in arr {
                        let _ = deep_link_app.emit("open-url", &url);
                    }
                }
            });
            commands::git::init_git_binary(app.handle());
            // Capture any `github <path>` cold-start args; flushed on renderer_ready.
            commands::cli::handle_startup_args(app.handle());
            // Local credential-helper trampoline server (HTTPS git auth).
            commands::trampoline::start(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // demo / runtime info
            commands::misc::greet,
            commands::misc::app_version,
            commands::misc::platform,
            // git
            commands::git::git_version,
            commands::git::git_exec,
            commands::git::git_exec_streaming,
            commands::git::is_git_repository,
            commands::git::current_branch,
            commands::git::local_branches,
            commands::git::status_entries,
            commands::git::recent_commits,
            commands::git::resolve_git_path,
            commands::git::set_custom_git_path,
            // filesystem (backs the fs / fs/promises shims)
            commands::fs::fs_exists,
            commands::fs::fs_read_text_file,
            commands::fs::fs_write_text_file,
            commands::fs::fs_stat,
            commands::fs::fs_lstat,
            commands::fs::fs_read_dir,
            commands::fs::fs_mkdir,
            commands::fs::fs_rm,
            commands::fs::fs_unlink,
            commands::fs::fs_realpath,
            // app lifecycle, paths, identity
            commands::app::get_path,
            commands::app::get_app_architecture,
            commands::app::get_app_path,
            commands::app::get_exec_path,
            commands::app::is_running_under_arm64_translation,
            commands::app::is_in_application_folder,
            commands::app::move_to_applications_folder,
            commands::app::get_apple_action_on_double_click,
            commands::app::save_guid,
            commands::app::get_guid,
            // window control & state
            commands::window::minimize_window,
            commands::window::maximize_window,
            commands::window::unmaximize_window,
            commands::window::close_window,
            commands::window::focus_window,
            commands::window::quit_app,
            commands::window::is_window_focused,
            commands::window::is_window_maximized,
            commands::window::get_current_window_state,
            commands::window::get_current_window_zoom_factor,
            commands::window::set_window_zoom_factor,
            commands::window::update_window_background_color,
            commands::window::toggle_dev_tools,
            // native shell integration
            commands::shell::move_to_trash,
            commands::shell::show_item_in_folder,
            commands::shell::open_external,
            commands::shell::unsafe_open_directory,
            commands::shell::launch_process,
            // native dialogs & contextual menu (stubs)
            commands::dialog::show_save_dialog,
            commands::dialog::show_open_dialog,
            commands::dialog::show_contextual_menu,
            commands::dialog::show_certificate_trust_dialog,
            // application menu (stubs)
            commands::menu::get_app_menu,
            commands::menu::execute_menu_item_by_id,
            commands::menu::update_menu_state,
            commands::menu::update_preferred_app_menu_item_labels,
            commands::menu::select_all_window_contents,
            // native theme
            commands::theme::should_use_dark_colors,
            commands::theme::set_native_theme_source,
            // credential storage (OS keychain via keyring)
            commands::secrets::get_password,
            commands::secrets::set_password,
            commands::secrets::delete_password,
            // auto-updater (JS-side; these remain stubs)
            commands::updates::check_for_updates,
            commands::updates::quit_and_install_updates,
            commands::updates::show_installing_update,
            // command-line integration (`github` shell command)
            commands::cli::install_windows_cli,
            commands::cli::uninstall_windows_cli,
            commands::cli::renderer_ready,
            // desktop notifications (stubs)
            commands::notifications::show_notification,
            commands::notifications::get_notifications_permission,
            commands::notifications::request_notifications_permission,
            // network helpers
            commands::network::resolve_proxy,
            // windows registry (editor/shell detection)
            commands::registry::registry_enumerate_keys,
            commands::registry::registry_enumerate_values,
            // credential trampoline (HTTPS git auth)
            commands::trampoline::trampoline_config,
            commands::trampoline::trampoline_response,
            // error & crash reporting (stubs)
            commands::errors::send_error_report,
            commands::errors::report_uncaught_exception,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
