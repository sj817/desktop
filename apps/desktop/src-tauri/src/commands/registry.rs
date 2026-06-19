//! Windows registry reads backing the registry-js shim, which the official
//! editor/shell detection (lib/editors/win32.ts, lib/shells/win32.ts,
//! lib/hooks/get-shell.ts) uses to find installed editors and terminals.
//! Non-Windows targets return empty results.

use serde::Serialize;

/// One registry value entry, shaped like registry-js's RegistryValue
/// ({ name, type, data }). `type` is the REG_* type name; `data` is the value
/// stringified (only string types carry meaningful data for our callers).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryValue {
    pub name: String,
    #[serde(rename = "type")]
    pub value_type: String,
    pub data: String,
}

/// `registry_enumerate_keys` — subkey names under hive\sub_key (empty if absent).
#[tauri::command]
pub async fn registry_enumerate_keys(hive_name: String, sub_key: String) -> Vec<String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || {
            imp::enumerate_keys(&hive_name, &sub_key)
        })
        .await
        .unwrap_or_default()
    }
    #[cfg(not(windows))]
    {
        let _ = (hive_name, sub_key);
        Vec::new()
    }
}

/// `registry_enumerate_values` — value entries under hive\sub_key (empty if absent).
#[tauri::command]
pub async fn registry_enumerate_values(
    hive_name: String,
    sub_key: String,
) -> Vec<RegistryValue> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || {
            imp::enumerate_values(&hive_name, &sub_key)
        })
        .await
        .unwrap_or_default()
    }
    #[cfg(not(windows))]
    {
        let _ = (hive_name, sub_key);
        Vec::new()
    }
}

#[cfg(windows)]
mod imp {
    use super::RegistryValue;
    use winreg::enums::*;
    use winreg::types::FromRegValue;
    use winreg::RegKey;

    fn hive(name: &str) -> Option<winreg::HKEY> {
        Some(match name {
            "HKEY_CLASSES_ROOT" => HKEY_CLASSES_ROOT,
            "HKEY_CURRENT_USER" => HKEY_CURRENT_USER,
            "HKEY_LOCAL_MACHINE" => HKEY_LOCAL_MACHINE,
            "HKEY_USERS" => HKEY_USERS,
            "HKEY_CURRENT_CONFIG" => HKEY_CURRENT_CONFIG,
            _ => return None,
        })
    }

    fn open(hive_name: &str, sub_key: &str) -> Option<RegKey> {
        let handle = hive(hive_name)?;
        RegKey::predef(handle).open_subkey(sub_key).ok()
    }

    pub fn enumerate_keys(hive_name: &str, sub_key: &str) -> Vec<String> {
        match open(hive_name, sub_key) {
            Some(key) => key.enum_keys().filter_map(Result::ok).collect(),
            None => Vec::new(),
        }
    }

    pub fn enumerate_values(hive_name: &str, sub_key: &str) -> Vec<RegistryValue> {
        let Some(key) = open(hive_name, sub_key) else {
            return Vec::new();
        };
        let mut out = Vec::new();
        for entry in key.enum_values() {
            let Ok((name, value)) = entry else { continue };
            out.push(RegistryValue {
                // REG_SZ / REG_EXPAND_SZ etc. — matches registry-js's type names.
                value_type: format!("{:?}", value.vtype),
                // Only string types yield data; others fall back to empty (the
                // callers only read string values).
                data: String::from_reg_value(&value).unwrap_or_default(),
                name,
            });
        }
        out
    }
}
