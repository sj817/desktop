//! Credential storage commands backing the `keytar` shim
//! (apps/desktop/src/shims/native/keytar.ts). Secrets are persisted in the
//! OS-native credential store via the cross-platform `keyring` crate:
//! Windows Credential Manager, macOS Keychain, and the Linux Secret Service
//! (libsecret / libdbus). The official renderer keys every secret by a
//! `service` string (e.g. "GitHub - https://api.github.com") and an `account`
//! (login / key hash / provider id); those map directly to a keyring `Entry`.

use keyring::{Entry, Error};

use crate::error::{AppResult, blocking};

/// Builds a keyring entry for the given service/account pair, surfacing
/// construction errors so they cross the Tauri IPC boundary.
fn entry(service: &str, account: &str) -> AppResult<Entry> {
    Ok(Entry::new(service, account)?)
}

// All async + run on a blocking task: OS credential-store access (Windows
// Credential Manager, macOS Keychain, Linux Secret Service over D-Bus) can block,
// and `get_password` is called at startup for each account — on the main thread it
// would jank the UI.

/// Returns the stored password for `service`/`account`, or `None` if no such
/// credential exists. Mirrors keytar.getPassword (resolves to `null`).
#[tauri::command]
pub async fn get_password(service: String, account: String) -> AppResult<Option<String>> {
    blocking(move || {
        match entry(&service, &account)?.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    })
    .await
}

/// Stores (creating or overwriting) the password for `service`/`account`.
/// Mirrors keytar.setPassword.
#[tauri::command]
pub async fn set_password(
    service: String,
    account: String,
    password: String,
) -> AppResult<()> {
    blocking(move || {
        entry(&service, &account)?
            .set_password(&password)
            .map_err(|e| e.into())
    })
    .await
}

/// Deletes the credential for `service`/`account`. Returns `true` if one was
/// removed, `false` if none existed. Mirrors keytar.deletePassword.
#[tauri::command]
pub async fn delete_password(service: String, account: String) -> AppResult<bool> {
    blocking(move || {
        match entry(&service, &account)?.delete_credential() {
            Ok(()) => Ok(true),
            Err(Error::NoEntry) => Ok(false),
            Err(e) => Err(e.into()),
        }
    })
    .await
}
