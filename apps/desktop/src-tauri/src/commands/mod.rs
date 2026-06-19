//! Tauri command modules, grouped by domain to mirror the Electron main-process
//! IPC surface defined in app/src/lib/ipc-shared.ts.
//!
//! `menu` and `updates` keep `#[allow(unused_variables)]` because they remain
//! intentional stubs (the app menu is built in the renderer; update checking is
//! done JS-side against the GitHub Releases API), so their parameters describe
//! the channel contract without being read.

pub mod app;
pub mod cli;
pub mod dialog;
pub mod errors;
pub mod fs;
pub mod git;
pub mod misc;
pub mod network;
pub mod notifications;
pub mod registry;
pub mod secrets;
pub mod shell;
pub mod theme;
pub mod trampoline;
pub mod window;

#[allow(unused_variables)]
pub mod menu;
#[allow(unused_variables)]
pub mod updates;
