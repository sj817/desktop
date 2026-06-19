// registry-js shim backed by the Rust registry commands (commands/registry.rs).
// The official editor/shell detection (lib/editors/win32.ts, lib/shells/win32.ts,
// lib/hooks/get-shell.ts) imports enumerateKeys/enumerateValues/HKEY/
// RegistryValueType from here. Native registry-js is synchronous; Tauri invoke is
// async, so these return Promises and the (already-async) callers await them.
import { invoke } from '@tauri-apps/api/core'

export const HKEY = {
  HKEY_CLASSES_ROOT: 'HKEY_CLASSES_ROOT',
  HKEY_CURRENT_USER: 'HKEY_CURRENT_USER',
  HKEY_LOCAL_MACHINE: 'HKEY_LOCAL_MACHINE',
  HKEY_USERS: 'HKEY_USERS',
  HKEY_CURRENT_CONFIG: 'HKEY_CURRENT_CONFIG',
} as const
export type HKEY = (typeof HKEY)[keyof typeof HKEY]

// Only the string types are meaningful to our callers; mirror registry-js names.
export const RegistryValueType = {
  REG_SZ: 'REG_SZ',
  REG_EXPAND_SZ: 'REG_EXPAND_SZ',
} as const

export type RegistryStringEntry = { name: string; type: string; data: string }
export type RegistryValue = RegistryStringEntry

export const enumerateKeys = (
  hive: HKEY,
  subKey: string
): Promise<ReadonlyArray<string>> =>
  invoke('registry_enumerate_keys', { hiveName: hive, subKey })

export const enumerateValues = (
  hive: HKEY,
  subKey: string
): Promise<ReadonlyArray<RegistryValue>> =>
  invoke('registry_enumerate_values', { hiveName: hive, subKey })

// Writes aren't needed by the renderer (the only writer was the squirrel CLI
// installer; this fork installs the CLI via Rust). Kept as a no-op for parity.
export const setValue = (): void => undefined
