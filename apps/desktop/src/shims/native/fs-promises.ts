// 'fs/promises' backed by Rust file commands (the official renderer assumed
// Node fs). Every function returns a real promise; unimplemented ones reject
// rather than throwing synchronously, so callers like pathExists() — which do
// access(path).then(true, false) — degrade gracefully instead of crashing.
import { invoke } from '@tauri-apps/api/core'

const notImplemented =
  (op: string) =>
  (): Promise<never> =>
    Promise.reject(
      new Error(`fs/promises.${op} is not implemented in the webview`)
    )

interface RawStat {
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
  size: number
  mtimeMs: number
}

const wrapStat = (s: RawStat) => ({
  size: s.size,
  mtimeMs: s.mtimeMs,
  isFile: () => s.isFile,
  isDirectory: () => s.isDirectory,
  isSymbolicLink: () => s.isSymbolicLink,
})

export const access = async (path: string) => {
  const exists = await invoke<boolean>('fs_exists', { path })
  if (!exists) {
    throw Object.assign(
      new Error(`ENOENT: no such file or directory, access '${path}'`),
      { code: 'ENOENT' }
    )
  }
}

export const stat = async (path: string) =>
  wrapStat(await invoke<RawStat>('fs_stat', { path }))

export const lstat = async (path: string) =>
  wrapStat(await invoke<RawStat>('fs_lstat', { path }))

// The official renderer reads text files (passes 'utf8' or {encoding:'utf8'})
// through fs/promises; binary reads are not supported here.
export const readFile = async (path: string, _options?: unknown) =>
  invoke<string>('fs_read_text_file', { path })

export const readdir = async (path: string) =>
  invoke<string[]>('fs_read_dir', { path })

export const writeFile = async (path: string, data: unknown) =>
  invoke<void>('fs_write_text_file', { path, contents: String(data) })

export const mkdir = async (path: string, options?: { recursive?: boolean }) =>
  invoke<void>('fs_mkdir', { path, recursive: options?.recursive ?? false })

export const rm = async (path: string, options?: { recursive?: boolean }) =>
  invoke<void>('fs_rm', { path, recursive: options?.recursive ?? false })

export const unlink = async (path: string) =>
  invoke<void>('fs_unlink', { path })

export const realpath = async (path: string) =>
  invoke<string>('fs_realpath', { path })

export const appendFile = notImplemented('appendFile')
export const cp = notImplemented('cp')
export const mkdtemp = notImplemented('mkdtemp')
export const open = notImplemented('open')
export const readlink = notImplemented('readlink')
export const symlink = notImplemented('symlink')
export const constants = {} as Record<string, number>

export default {
  access,
  appendFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
  constants,
}
