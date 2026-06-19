// Stub for electron-window-state (main-process window bounds persistence).
// Window lifecycle/bounds are owned by Tauri (tauri.conf.json + Rust), so the
// ported main-process code path never runs in the webview. Returns a no-op
// keeper with the app's default size in case anything touches it.
export interface WindowState {
  x: number | undefined
  y: number | undefined
  width: number
  height: number
  isMaximized?: boolean
  isFullScreen?: boolean
  manage(window: unknown): void
  unmanage(): void
  saveState(window: unknown): void
}

export default function windowStateKeeper(_opts?: {
  defaultWidth?: number
  defaultHeight?: number
}): WindowState {
  return {
    x: undefined,
    y: undefined,
    width: _opts?.defaultWidth ?? 960,
    height: _opts?.defaultHeight ?? 660,
    manage() {},
    unmanage() {},
    saveState() {},
  }
}
