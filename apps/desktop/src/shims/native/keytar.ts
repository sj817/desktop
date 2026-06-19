// Shim for keytar (native credential store) that routes credential reads/writes
// through the Rust `secrets` commands, persisting secrets in the OS-native
// keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service).
// Aliased as `keytar` in vite.config.ts. The official renderer imports this as
// `import * as keytar from 'keytar'` and keys each secret by (service, account).
import { invoke } from '@tauri-apps/api/core'

/** Returns the stored password for the service/account, or null if absent. */
export const getPassword = (
  service: string,
  account: string
): Promise<string | null> =>
  invoke<string | null>('get_password', { service, account })

/** Stores (creating or overwriting) the password for the service/account. */
export const setPassword = (
  service: string,
  account: string,
  password: string
): Promise<void> => invoke<void>('set_password', { service, account, password })

/** Deletes the credential; resolves true if one was removed, false otherwise. */
export const deletePassword = (
  service: string,
  account: string
): Promise<boolean> => invoke<boolean>('delete_password', { service, account })

// keytar.findCredentials enumerates every account under a service. The official
// renderer never calls it (no references under official/src) and the keyring
// crate cannot enumerate entries, so return an empty list for type parity.
export const findCredentials = async (
  service: string
): Promise<ReadonlyArray<{ account: string; password: string }>> => []

export default { getPassword, setPassword, deletePassword, findCredentials }
