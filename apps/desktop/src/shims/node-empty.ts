// Shim for Node built-ins with no webview equivalent. child_process.spawn
// routes through the Rust launch_process command. Other child_process APIs
// throw clearly. net provides non-throwing fakes so startup code proceeds.
import { invoke } from '@tauri-apps/api/core'
import { EventEmitter } from 'events'

function unavailable(name: string): never {
  throw new Error(
    `Node '${name}' is not available in the Tauri webview — route this through a Rust command (see docs/OFFICIAL_UI_PORT.md).`
  )
}

// --- child_process ---
// spawn routes to Rust launch_process; returns a fake ChildProcess that
// emits 'spawn' on success and 'error' on failure.
export function spawn(
  cmd: string,
  args?: readonly string[],
  options?: Record<string, unknown>
) {
  const cp = new EventEmitter()
  // ChildProcess-compatible properties that callers may access
  ;(cp as any).pid = -1
  ;(cp as any).stdin = null
  ;(cp as any).stdout = null
  ;(cp as any).stderr = null
  ;(cp as any).unref = () => {}
  ;(cp as any).kill = () => false

  const cwd = (options?.cwd as string) ?? undefined
  const useShell = options?.shell === true

  invoke('launch_process', {
    cmd,
    args: args ? [...args] : [],
    cwd,
    useShell,
  })
    .then(() => {
      ;(cp as any).pid = 1
      cp.emit('spawn')
    })
    .catch(err => {
      cp.emit('error', new Error(String(err)))
    })

  return cp
}

export const exec = () => unavailable('child_process.exec')
export const execFile = (..._args: unknown[]) => {
  // isGitOnPath calls execFile('which', ['git'], cb) or similar.
  // Return a fake that immediately calls back with an error — the caller
  // handles the "git not found" case gracefully.
  const cb = _args.find(a => typeof a === 'function') as
    | ((err: Error | null, stdout?: string, stderr?: string) => void)
    | undefined
  if (cb) {
    queueMicrotask(() => cb(new Error('execFile not available in Tauri')))
    return { on: () => {}, kill: () => {} }
  }
  unavailable('child_process.execFile')
}
export const execSync = () => unavailable('child_process.execSync')
export const spawnSync = () => unavailable('child_process.spawnSync')

// --- net (non-throwing fakes so startup proceeds) ---
class FakeSocket {
  on() {
    return this
  }
  once() {
    return this
  }
  write() {
    return true
  }
  end() {}
  destroy() {}
  connect() {
    return this
  }
  setEncoding() {
    return this
  }
  unref() {
    return this
  }
}

class FakeServer {
  private handlers: Record<string, Array<(...a: unknown[]) => void>> = {}
  // A non-zero fake port so callers that gate on address().port (e.g. the
  // trampoline server's getPort) proceed. There's no real socket — local git
  // operations never connect back to it.
  private fakePort = 49152

  on(event: string, cb: (...a: unknown[]) => void) {
    ;(this.handlers[event] ??= []).push(cb)
    return this
  }
  once(event: string, cb: (...a: unknown[]) => void) {
    return this.on(event, cb)
  }
  listen(...args: unknown[]) {
    const cb = args.find(a => typeof a === 'function') as
      | (() => void)
      | undefined
    // Resolve asynchronously like the real server's 'listening' event so
    // awaiters (the trampoline server builds git env from getPort()) proceed.
    queueMicrotask(() => {
      cb?.()
      this.handlers['listening']?.forEach(h => h())
    })
    return this
  }
  close(cb?: () => void) {
    if (typeof cb === 'function') {
      cb()
    }
    return this
  }
  address() {
    return { port: this.fakePort, address: '127.0.0.1', family: 'IPv4' }
  }
  unref() {
    return this
  }
}

export const createServer = () => new FakeServer()
export const connect = () => new FakeSocket()
export const Socket = FakeSocket

// net address helpers are pure and safe to provide.
export const isIPv4 = (s: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(s)
export const isIPv6 = (s: string) => s.includes(':')
export const isIP = (s: string) => (isIPv4(s) ? 4 : isIPv6(s) ? 6 : 0)

export default {}
