import { invoke } from '@tauri-apps/api/core'

/** Attempts to resolve the full path to the git binary via Rust */
export const findGitOnPath = async (): Promise<string | undefined> => {
  try {
    return await invoke<string>('resolve_git_path')
  } catch (err) {
    log.warn('Failed trying to find Git on PATH', err)
    return undefined
  }
}

/** Returns a value indicating whether Git was found */
export const isGitOnPath = async (): Promise<boolean> =>
  (await findGitOnPath()) !== undefined
