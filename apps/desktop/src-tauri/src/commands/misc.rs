//! Misc commands: demo greeting plus small runtime info helpers.

/// Example greeting command.
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}! Welcome to GitHub Desktop Next.")
}

/// Returns the version baked into the Rust crate at compile time.
#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Host operating system: "windows" | "macos" | "linux".
#[tauri::command]
pub fn platform() -> String {
    std::env::consts::OS.to_string()
}
