import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export interface StatusEntry {
  status: string
  path: string
}

export interface CommitInfo {
  sha: string
  shortSha: string
  summary: string
  author: string
  date: string
}

export type ThemeSource = 'system' | 'light' | 'dark'

// Thin typed wrappers around the Rust commands (mirrors app/src/lib/ipc-shared.ts).
export const api = {
  appVersion: () => invoke<string>('app_version'),
  platform: () => invoke<string>('platform'),
  architecture: () => invoke<string>('get_app_architecture'),
  gitVersion: () => invoke<string>('git_version'),

  isGitRepository: (path: string) =>
    invoke<boolean>('is_git_repository', { path }),
  currentBranch: (path: string) => invoke<string>('current_branch', { path }),
  localBranches: (path: string) => invoke<string[]>('local_branches', { path }),
  statusEntries: (path: string) =>
    invoke<StatusEntry[]>('status_entries', { path }),
  recentCommits: (path: string, limit: number) =>
    invoke<CommitInfo[]>('recent_commits', { path, limit }),

  showItemInFolder: (path: string) =>
    invoke<void>('show_item_in_folder', { path }),
  openExternal: (path: string) => invoke<boolean>('open_external', { path }),

  minimizeWindow: () => invoke<void>('minimize_window'),
  maximizeWindow: () => invoke<void>('maximize_window'),
  closeWindow: () => invoke<void>('close_window'),

  setThemeSource: (theme: ThemeSource) =>
    invoke<void>('set_native_theme_source', { themeName: theme }),

  // Native folder picker via the dialog plugin.
  pickDirectory: async () => {
    const selected = await open({ directory: true, multiple: false })
    return typeof selected === 'string' ? selected : null
  },
}
