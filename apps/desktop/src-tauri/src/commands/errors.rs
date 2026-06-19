//! Error & crash reporting. Mirrors error channels in app/src/lib/ipc-shared.ts.
//!
//! This fork ships with all telemetry disabled (see lib/stats/stats-store.ts and
//! the removal of the usage-tracking UI), so crash/error reports are never
//! forwarded anywhere. These remain successful no-ops so the renderer's reporting
//! paths complete cleanly instead of surfacing "command failed" warnings.

use serde_json::Value;

use crate::error::AppResult;

/// `send-error-report` — forward a captured error to the crash reporter (disabled).
#[tauri::command]
pub fn send_error_report(error: Value, extra: Value, non_fatal: bool) -> AppResult<()> {
    let _ = (error, extra, non_fatal);
    Ok(())
}

/// `uncaught-exception` — report an uncaught exception from the renderer (disabled).
#[tauri::command]
pub fn report_uncaught_exception(error: Value) -> AppResult<()> {
    let _ = error;
    Ok(())
}
