//! Filesystem commands backing the renderer's `fs` / `fs/promises` shims. The
//! official renderer assumed Node fs (it ran in Electron's node-integrated
//! renderer); these move real, cross-platform file access into Rust.

use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::error::{AppResult, blocking};

/// Subset of Node's fs.Stats that the renderer actually reads. The shim wraps
/// this with isFile()/isDirectory()/isSymbolicLink() methods.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsStat {
    pub is_file: bool,
    pub is_directory: bool,
    pub is_symbolic_link: bool,
    pub size: u64,
    pub mtime_ms: f64,
}

fn to_stat(meta: &fs::Metadata, is_symbolic_link: bool) -> FsStat {
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0);

    FsStat {
        is_file: meta.is_file(),
        is_directory: meta.is_dir(),
        is_symbolic_link,
        size: meta.len(),
        mtime_ms,
    }
}

// All commands are async + run on a blocking task so file I/O never blocks the
// main (UI) thread. The official Electron app uses fs/promises throughout for
// the same reason; a synchronous `#[tauri::command]` runs on the main thread, so
// a large `fs_read_text_file` (a big diff) or `fs_read_dir` (a huge directory)
// would jank the UI. Tiny metadata calls are converted too for consistency.

#[tauri::command]
pub async fn fs_exists(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || Path::new(&path).exists())
        .await
        .unwrap_or(false)
}

#[tauri::command]
pub async fn fs_read_text_file(path: String) -> AppResult<String> {
    blocking(move || {
        Ok(fs::read_to_string(&path)?)
    })
    .await
}

#[tauri::command]
pub async fn fs_write_text_file(path: String, contents: String) -> AppResult<()> {
    blocking(move || {
        Ok(fs::write(&path, contents)?)
    })
    .await
}

#[tauri::command]
pub async fn fs_stat(path: String) -> AppResult<FsStat> {
    blocking(move || {
        let meta = fs::metadata(&path)?;
        Ok(to_stat(&meta, false))
    })
    .await
}

#[tauri::command]
pub async fn fs_lstat(path: String) -> AppResult<FsStat> {
    blocking(move || {
        let meta = fs::symlink_metadata(&path)?;
        let is_symbolic_link = meta.file_type().is_symlink();
        Ok(to_stat(&meta, is_symbolic_link))
    })
    .await
}

#[tauri::command]
pub async fn fs_read_dir(path: String) -> AppResult<Vec<String>> {
    blocking(move || {
        let mut names = Vec::new();
        for entry in fs::read_dir(&path)? {
            let entry = entry?;
            names.push(entry.file_name().to_string_lossy().to_string());
        }
        Ok(names)
    })
    .await
}

#[tauri::command]
pub async fn fs_mkdir(path: String, recursive: Option<bool>) -> AppResult<()> {
    blocking(move || {
        if recursive.unwrap_or(false) {
            fs::create_dir_all(&path)?;
        } else {
            fs::create_dir(&path)?;
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn fs_rm(path: String, recursive: Option<bool>) -> AppResult<()> {
    blocking(move || {
        let p = Path::new(&path);
        if p.is_dir() {
            if recursive.unwrap_or(false) {
                fs::remove_dir_all(p)?;
            } else {
                fs::remove_dir(p)?;
            }
        } else {
            fs::remove_file(p)?;
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn fs_unlink(path: String) -> AppResult<()> {
    blocking(move || {
        fs::remove_file(&path)?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn fs_realpath(path: String) -> AppResult<String> {
    blocking(move || {
        let canon = fs::canonicalize(&path)?;
        Ok(canon.to_string_lossy().to_string())
    })
    .await
}
