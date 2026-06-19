// Stub for `process-proxy` — the native Git-hooks process proxy. Upstream this is
// a local socket server plus a sidecar binary that relays a hook's stdio, args,
// env, cwd, and exit code back to the app. There's no webview equivalent and hook
// proxying isn't wired into the Tauri build yet, so these throw if invoked.
// withHooksEnv() only reaches them when a repository actually has hooks (the
// no-hooks path returns earlier), so the common case never touches this.
import type { Readable, Writable } from 'stream'
import type { Server } from 'net'

const unsupported = (): never => {
  throw new Error(
    'process-proxy (Git hooks proxy) is not supported in this build'
  )
}

export class ProcessProxyConnection {
  get stdin(): Readable {
    return unsupported()
  }
  get stderr(): Writable {
    return unsupported()
  }
  exit(_code?: number): Promise<void> {
    return unsupported()
  }
  getArgs(): Promise<ReadonlyArray<string>> {
    return unsupported()
  }
  getEnv(): Promise<Record<string, string>> {
    return unsupported()
  }
  getCwd(): Promise<string> {
    return unsupported()
  }
  isStdinConnected(): Promise<boolean> {
    return unsupported()
  }
  on(_event: 'close', _listener: () => void): this {
    return unsupported()
  }
}

export function createProxyProcessServer(
  _onConnection: (conn: ProcessProxyConnection) => void,
  _options?: {
    validateConnection?: (token: string) => boolean | Promise<boolean>
  }
): Server {
  return unsupported()
}
