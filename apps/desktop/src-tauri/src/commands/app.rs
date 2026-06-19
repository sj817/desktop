//! App lifecycle, paths, identity. Mirrors RequestResponseChannels in
//! app/src/lib/ipc-shared.ts. Cross-platform via std + Tauri's path resolver.

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult, blocking};

fn map_arch(arch: &str) -> &str {
    match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => other,
    }
}

/// `get-app-architecture` — the running app's CPU architecture.
#[tauri::command]
pub fn get_app_architecture() -> AppResult<String> {
    Ok(map_arch(std::env::consts::ARCH).to_string())
}

/// `get-app-path` — directory the executable lives in (closest analogue to
/// Electron's app.getAppPath()).
#[tauri::command]
pub fn get_app_path() -> AppResult<String> {
    let exe = std::env::current_exe()?;
    let dir = exe
        .parent()
        .ok_or(AppError::InvalidInput("executable has no parent directory".into()))?;
    Ok(dir.to_string_lossy().to_string())
}

/// `get-exec-path` — absolute path to the executable.
#[tauri::command]
pub fn get_exec_path() -> AppResult<String> {
    Ok(std::env::current_exe()?.to_string_lossy().to_string())
}

/// `get-path` — resolve a named PathType to an absolute path.
#[tauri::command]
pub fn get_path(app: AppHandle, path_type: String) -> AppResult<String> {
    let p = app.path();
    let resolved: PathBuf = match path_type.as_str() {
        "home" => p.home_dir(),
        "appData" => p.data_dir(),
        "userData" => p.app_data_dir(),
        "temp" => p.temp_dir(),
        "desktop" => p.desktop_dir(),
        "documents" => p.document_dir(),
        "downloads" => p.download_dir(),
        "logs" => p.app_log_dir(),
        other => return Err(AppError::InvalidInput(format!("unknown path type: {other}"))),
    }?;
    Ok(resolved.to_string_lossy().to_string())
}

/// `is-running-under-arm64-translation` — are we an x86 binary running under an
/// ARM64 host's emulation layer (macOS Rosetta 2 / Windows x64-on-ARM64)?
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn is_running_under_arm64_translation() -> AppResult<bool> {
    blocking(|| {
        let output = std::process::Command::new("sysctl")
            .args(["-n", "sysctl.proc_translated"])
            .output();
        Ok(matches!(output, Ok(o) if String::from_utf8_lossy(&o.stdout).trim() == "1"))
    })
    .await
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn is_running_under_arm64_translation() -> AppResult<bool> {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> isize;
        fn IsWow64Process2(
            process: isize,
            process_machine: *mut u16,
            native_machine: *mut u16,
        ) -> i32;
    }
    const IMAGE_FILE_MACHINE_UNKNOWN: u16 = 0x0000;
    const IMAGE_FILE_MACHINE_ARM64: u16 = 0xAA64;

    let mut process_machine: u16 = 0;
    let mut native_machine: u16 = 0;
    let ok = unsafe {
        IsWow64Process2(
            GetCurrentProcess(),
            &mut process_machine,
            &mut native_machine,
        )
    };
    if ok == 0 {
        return Ok(false);
    }
    Ok(process_machine != IMAGE_FILE_MACHINE_UNKNOWN && native_machine == IMAGE_FILE_MACHINE_ARM64)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
pub fn is_running_under_arm64_translation() -> AppResult<bool> {
    Ok(false)
}

/// `is-in-application-folder` — whether the .app bundle lives under an
/// Applications folder. macOS-specific; returns None (not applicable) elsewhere.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn is_in_application_folder() -> AppResult<Option<bool>> {
    let exe = std::env::current_exe()?;
    let path = exe.to_string_lossy();
    Ok(Some(path.contains("/Applications/")))
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn is_in_application_folder() -> AppResult<Option<bool>> {
    Ok(None)
}

/// `move-to-applications-folder` — copy the running .app bundle into
/// /Applications, launch the moved copy, and quit this instance. macOS-only.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn move_to_applications_folder(app: AppHandle) -> AppResult<()> {
    blocking(move || {
        let exe = std::env::current_exe()?;
        let bundle = exe
            .ancestors()
            .nth(3)
            .ok_or(AppError::InvalidInput("could not locate the .app bundle".into()))?
            .to_path_buf();
        if bundle.extension().and_then(|e| e.to_str()) != Some("app") {
            return Err(AppError::InvalidInput("not running from a .app bundle".into()));
        }
        let name = bundle
            .file_name()
            .ok_or(AppError::InvalidInput("bundle has no name".into()))?;
        let dest = PathBuf::from("/Applications").join(name);
        if dest == bundle {
            return Ok(());
        }

        let status = std::process::Command::new("ditto")
            .arg(&bundle)
            .arg(&dest)
            .status()?;
        if !status.success() {
            return Err(AppError::Internal("failed to copy the app into /Applications".into()));
        }

        let _ = std::process::Command::new("open").arg(&dest).spawn();
        app.exit(0);
        Ok(())
    })
    .await
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn move_to_applications_folder() -> AppResult<()> {
    Ok(())
}

/// `get-apple-action-on-double-click` — the system "double-click a window title
/// bar to" preference (Maximize/Minimize/None). macOS-only; Maximize elsewhere.
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn get_apple_action_on_double_click() -> AppResult<String> {
    blocking(|| {
        let output = std::process::Command::new("defaults")
            .args(["read", "-g", "AppleActionOnDoubleClick"])
            .output();
        match output {
            Ok(o) if o.status.success() => {
                let value = String::from_utf8_lossy(&o.stdout).trim().to_string();
                Ok(if value.is_empty() {
                    "Maximize".to_string()
                } else {
                    value
                })
            }
            _ => Ok("Maximize".to_string()),
        }
    })
    .await
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn get_apple_action_on_double_click() -> AppResult<String> {
    Ok("Maximize".to_string())
}

fn guid_file(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app.path().app_config_dir()?;
    Ok(dir.join("guid.txt"))
}

/// `get-guid` — read the persisted application GUID (empty if unset).
#[tauri::command]
pub async fn get_guid(app: AppHandle) -> AppResult<String> {
    let file = guid_file(&app)?;
    blocking(move || match fs::read_to_string(&file) {
        Ok(s) => Ok(s.trim().to_string()),
        Err(_) => Ok(String::new()),
    })
    .await
}

/// `save-guid` — persist the application GUID.
#[tauri::command]
pub async fn save_guid(app: AppHandle, guid: String) -> AppResult<()> {
    let file = guid_file(&app)?;
    blocking(move || {
        if let Some(parent) = file.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&file, guid)?;
        Ok(())
    })
    .await
}
