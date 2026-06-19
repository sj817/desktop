// Shim for dugite that routes git execution through Rust commands so the
// official lib/git layer works unchanged.
//
// - Buffered commands go through `git_exec` (full stdout/stderr returned at once).
// - Commands that supply a processCallback AND stream progress/output
//   (clone/fetch/pull/push via --progress, plus cherry-pick/rebase/revert/am
//   which read the child's stdout/stderr line by line) go through
//   `git_exec_streaming`, which emits one `git-progress` event per output line.
//   We synthesize a ChildProcess-shaped object (real Node Readable stdout/stderr
//   + an EventEmitter 'close') and feed it the streamed lines, so the upstream
//   progress parsers (lib/progress/from-process.ts via byline) run unchanged.
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Readable } from 'stream'
import { EventEmitter } from 'events'
import {
  GitError,
  GitErrorRegexes,
  parseError,
  parseBadConfigValueErrorInfo,
} from './dugite-errors'

export { GitError, GitErrorRegexes, parseError, parseBadConfigValueErrorInfo }

export type IGitSpawnOptions = Record<string, unknown>
export interface IGitExecutionOptions {
  stdin?: string | Uint8Array
  env?: Record<string, string | undefined>
  encoding?: string
  processCallback?: (process: unknown) => void
  [key: string]: unknown
}
export interface IGitResult {
  stdout: string | Buffer
  stderr: string | Buffer
  exitCode: number
}

interface RawGitResult {
  stdout: string
  stderr: string
  exitCode: number
  isBase64: boolean
}

interface GitProgressPayload {
  id: string
  stream: 'stdout' | 'stderr'
  line: string
}

const STREAMING_SUBCOMMANDS = new Set([
  'clone',
  'fetch',
  'pull',
  'push',
  'cherry-pick',
  'rebase',
  'revert',
  'am',
])

let execCounter = 0

function needsStreaming(
  args: ReadonlyArray<string>,
  options?: IGitExecutionOptions
): boolean {
  if (!options?.processCallback) {
    return false
  }
  if (args.includes('--progress')) {
    return true
  }
  return args.some(a => STREAMING_SUBCOMMANDS.has(a))
}

function coerceStdin(raw: string | Uint8Array | undefined): string | undefined {
  return raw == null
    ? undefined
    : typeof raw === 'string'
      ? raw
      : new TextDecoder().decode(raw)
}

interface TrampolineConfig {
  port: number
  token: string
  helperPath: string
}

let trampolineConfigPromise: Promise<TrampolineConfig> | null = null
function getTrampolineConfig(): Promise<TrampolineConfig> {
  if (!trampolineConfigPromise) {
    trampolineConfigPromise = invoke<TrampolineConfig>('trampoline_config')
  }
  return trampolineConfigPromise
}

async function applyCredentialEnv(
  env: Record<string, string | undefined> | undefined
): Promise<Record<string, string | undefined> | undefined> {
  if (!env) {
    return env
  }
  const params = env['GIT_CONFIG_PARAMETERS']
  const usesTrampoline =
    'DESKTOP_PORT' in env ||
    (typeof params === 'string' && params.includes('credential.helper=desktop'))
  if (!usesTrampoline) {
    return env
  }

  try {
    const cfg = await getTrampolineConfig()
    if (cfg && cfg.port > 0) {
      return {
        ...env,
        DESKTOP_PORT: String(cfg.port),
        DESKTOP_TRAMPOLINE_TOKEN: cfg.token,
      }
    }
  } catch {
    // Server not ready; leave the env as-is.
  }
  return env
}

function coerceEnv(
  env: Record<string, string | undefined> | undefined
): Record<string, string | null> | null {
  if (!env) {
    return null
  }
  const out: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(env)) {
    out[key] = value == null ? null : String(value)
  }
  return out
}

// Decode a base64-encoded string from Rust (binary mode) into a Buffer.
function decodeBase64(b64: string): Buffer {
  return Buffer.from(b64, 'base64')
}

// Decode a git result field based on the isBase64 flag and desired encoding.
function decodeField(
  data: string,
  isBase64: boolean,
  wantBuffer: boolean
): string | Buffer {
  if (isBase64) {
    const buf = decodeBase64(data)
    return wantBuffer ? buf : buf.toString('utf-8')
  }
  // Already a UTF-8 string from Rust.
  return wantBuffer ? Buffer.from(data, 'utf-8') : data
}

export async function exec(
  args: ReadonlyArray<string>,
  path: string,
  options?: IGitExecutionOptions
): Promise<IGitResult> {
  const stdin = coerceStdin(options?.stdin)
  const env = coerceEnv(await applyCredentialEnv(options?.env))
  const wantBuffer = options?.encoding === 'buffer'

  if (needsStreaming(args, options)) {
    return execStreaming(
      args,
      path,
      options as IGitExecutionOptions,
      stdin,
      env,
      wantBuffer
    )
  }

  const execResult = await invoke<RawGitResult>('git_exec', {
    repoPath: path,
    args: [...args],
    stdin,
    env,
    binary: wantBuffer,
  })

  return {
    stdout: decodeField(execResult.stdout, execResult.isBase64, wantBuffer),
    stderr: decodeField(execResult.stderr, execResult.isBase64, wantBuffer),
    exitCode: execResult.exitCode,
  }
}

async function execStreaming(
  args: ReadonlyArray<string>,
  path: string,
  options: IGitExecutionOptions,
  stdin: string | undefined,
  env: Record<string, string | null> | null,
  wantBuffer: boolean
): Promise<IGitResult> {
  const id = `git-exec-${++execCounter}`

  const stdout = new Readable({ read() {} })
  const stderr = new Readable({ read() {} })
  const proc = new EventEmitter() as EventEmitter & {
    stdout: Readable
    stderr: Readable
    pid: number
  }
  proc.stdout = stdout
  proc.stderr = stderr
  proc.pid = -1

  options.processCallback?.(proc)

  const unlisten = await listen<GitProgressPayload>('git-progress', event => {
    const payload = event.payload
    if (payload.id !== id) {
      return
    }
    const stream = payload.stream === 'stderr' ? stderr : stdout
    stream.push(payload.line + '\n')
  })

  const finish = (exitCode: number) => {
    unlisten()
    stdout.push(null)
    stderr.push(null)
    proc.emit('close', exitCode, null)
  }

  let execResult: RawGitResult
  try {
    execResult = await invoke<RawGitResult>('git_exec_streaming', {
      id,
      repoPath: path,
      args: [...args],
      stdin,
      env,
      binary: wantBuffer,
    })
  } catch (e) {
    finish(-1)
    throw e
  }

  finish(execResult.exitCode)

  return {
    stdout: decodeField(execResult.stdout, execResult.isBase64, wantBuffer),
    stderr: decodeField(execResult.stderr, execResult.isBase64, wantBuffer),
    exitCode: execResult.exitCode,
  }
}

export const spawn = (): never => {
  throw new Error(
    'git spawn (streaming) is not supported yet — use exec with a processCallback'
  )
}

export const resolveGitBinary = async () => ({ path: 'git', version: '' })

export class ExecError extends Error {}
