//! Names of the main -> renderer events (Tauri `emit`/`listen`), mirroring the
//! simplex `RequestChannels` in app/src/lib/ipc-shared.ts that flow from the
//! backend to the UI. Payload typing and exact direction are refined as each
//! subsystem is implemented (structure first, fix later).
#![allow(dead_code)]

pub const MENU_EVENT: &str = "menu-event";
pub const APP_MENU: &str = "app-menu";

// Contextual (right-click) menu selection results are emitted per-request as
// `contextual-menu-result-<request_id>` with a `number[]` index-path payload.
pub const CONTEXTUAL_MENU_RESULT_PREFIX: &str = "contextual-menu-result-";
pub const FOCUS: &str = "focus";
pub const BLUR: &str = "blur";
pub const FOCUS_WINDOW: &str = "focus-window";
pub const URL_ACTION: &str = "url-action";
pub const CLI_ACTION: &str = "cli-action";
pub const LAUNCH_TIMING_STATS: &str = "launch-timing-stats";
pub const WINDOW_STATE_CHANGED: &str = "window-state-changed";
pub const ZOOM_FACTOR_CHANGED: &str = "zoom-factor-changed";

// Streamed git output (clone/fetch/pull/push progress, cherry-pick/rebase
// line output). Payload: { id, stream: "stdout"|"stderr", line }.
pub const GIT_PROGRESS: &str = "git-progress";
pub const UPDATE_ACCOUNTS: &str = "update-accounts";
pub const NATIVE_THEME_UPDATED: &str = "native-theme-updated";
pub const NOTIFICATION_EVENT: &str = "notification-event";
pub const CERTIFICATE_ERROR: &str = "certificate-error";
pub const SHOW_CERTIFICATE_TRUST_DIALOG: &str = "show-certificate-trust-dialog";
pub const WILL_QUIT: &str = "will-quit";
pub const WILL_QUIT_EVEN_IF_UPDATING: &str = "will-quit-even-if-updating";
pub const CANCEL_QUITTING: &str = "cancel-quitting";

// Auto-updater lifecycle.
pub const AUTO_UPDATER_ERROR: &str = "auto-updater-error";
pub const AUTO_UPDATER_CHECKING_FOR_UPDATE: &str = "auto-updater-checking-for-update";
pub const AUTO_UPDATER_UPDATE_AVAILABLE: &str = "auto-updater-update-available";
pub const AUTO_UPDATER_UPDATE_NOT_AVAILABLE: &str = "auto-updater-update-not-available";
pub const AUTO_UPDATER_UPDATE_DOWNLOADED: &str = "auto-updater-update-downloaded";
pub const SHOW_INSTALLING_UPDATE: &str = "show-installing-update";
