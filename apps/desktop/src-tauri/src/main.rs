// Prevents an extra console window from showing on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    github_desktop_next_lib::run()
}
