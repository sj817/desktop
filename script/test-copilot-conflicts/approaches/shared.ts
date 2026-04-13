/**
 * Shared Copilot SDK client setup for benchmark approaches.
 *
 * Replicates the CopilotClient construction pattern from
 * app/src/lib/stores/copilot-store.ts, adapted for standalone script usage.
 */

import { join } from 'path'
import { pathToFileURL } from 'url'

type CopilotClientConstructor = new (opts: Record<string, unknown>) => ICopilotClientInstance
interface ICopilotSession {
  on(event: string, handler: (...args: unknown[]) => void): void
  sendAndWait(msg: { prompt: string }, timeout: number): Promise<{ data: { content: string } } | null>
  destroy(): Promise<void>
}
export interface ICopilotClientInstance {
  createSession(config: Record<string, unknown>): Promise<ICopilotSession>
  stop(): Promise<void>
  listModels?(): Promise<Array<{ id: string; name?: string }>>
}

/**
 * Lazily load the CopilotClient constructor.
 * This avoids failing at import time when the SDK isn't installed
 * (e.g. when running --list or --help).
 *
 * We resolve the SDK from app/node_modules since the dependency is
 * declared in app/package.json, not the root package.json.
 */
function getCopilotClientConstructor(): CopilotClientConstructor {
  const { createRequire } = require('module') as typeof import('module')
  const appRequire = createRequire(
    join(__dirname, '..', '..', '..', 'app', 'package.json')
  )
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CopilotClient } = appRequire('@github/copilot-sdk') as {
    CopilotClient: CopilotClientConstructor
  }
  return CopilotClient
}

/**
 * Information about an available model.
 */
export interface IModelInfo {
  readonly id: string
  readonly name: string
}

/**
 * Resolve the path to the Copilot CLI entry point bundled with Desktop.
 *
 * The CLI is installed as a dependency in app/node_modules/@github/copilot-sdk
 * and includes a CLI directory with an index.js entry point.
 */
function getCopilotCLIDir(): string {
  // __dirname is script/test-copilot-conflicts/approaches/
  // We need to go up 3 levels to reach the repo root, then into app/node_modules
  return join(__dirname, '..', '..', '..', 'app', 'node_modules', '@github', 'copilot-sdk', 'cli')
}

/**
 * Get the path to the Node/Electron executable.
 *
 * In script context we use the current Node.js process executable directly,
 * since we're not running inside Electron.
 */
function getCopilotCLIPath(): string {
  return process.execPath
}

/**
 * Get a GitHub token for Copilot API access.
 *
 * Checks GITHUB_TOKEN environment variable. The token must have Copilot
 * access (typically a user token from a GitHub.com account with Copilot).
 */
export function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN environment variable is required.\n' +
      'Set it to a GitHub.com personal access token with Copilot access.\n' +
      'Example: export GITHUB_TOKEN=ghp_...'
    )
  }
  return token
}

/**
 * Create a CopilotClient instance for the given repository path.
 *
 * This mirrors the pattern from copilot-store.ts but adapted for
 * standalone script usage (no Electron, no ipcRenderer).
 */
export async function createCopilotClient(
  repositoryPath: string,
  token: string
): Promise<ICopilotClientInstance> {
  const cliDir = getCopilotCLIDir()
  let importPath = join(cliDir, 'index.js')

  if (process.platform === 'win32') {
    importPath = pathToFileURL(importPath).href
  }

  const ClientCtor = getCopilotClientConstructor()
  return new ClientCtor({
    cliPath: getCopilotCLIPath(),
    cliArgs: ['--eval', `import '${importPath}'`, '--'],
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      COPILOT_RUN_APP: '1',
    },
    cwd: repositoryPath,
    autoStart: true,
    githubToken: token,
  })
}

/**
 * Discover available models from the Copilot SDK.
 */
export async function discoverModels(
  client: ICopilotClientInstance
): Promise<ReadonlyArray<IModelInfo>> {
  try {
    const models = await client.listModels?.()

    if (!models) {
      return [{ id: 'gpt-5-mini', name: 'GPT-5 Mini' }]
    }

    return models.map(m => ({
      id: m.id,
      name: m.name ?? m.id,
    }))
  } catch {
    // Fall back to known models if discovery fails
    return [{ id: 'gpt-5-mini', name: 'GPT-5 Mini' }]
  }
}

/**
 * Stop a CopilotClient, suppressing errors.
 */
export async function stopClient(client: ICopilotClientInstance): Promise<void> {
  try {
    await client.stop()
  } catch {
    // Best effort cleanup
  }
}
