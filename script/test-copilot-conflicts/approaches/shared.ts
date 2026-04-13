/**
 * Shared Copilot SDK client setup for benchmark approaches.
 *
 * Uses the SDK's built-in CLI spawning (no Electron-specific CLI path).
 */

import { join } from 'path'
import { execSync } from 'child_process'

type CopilotClientConstructor = new (opts: Record<string, unknown>) => ICopilotClientInstance
interface ICopilotSession {
  on(event: string, handler: (...args: unknown[]) => void): () => void
  sendAndWait(msg: { prompt: string }, timeout: number): Promise<{ type: string; data: { content: string } } | undefined>
  destroy(): Promise<void>
  disconnect(): Promise<void>
}
export interface ICopilotClientInstance {
  createSession(config: Record<string, unknown>): Promise<ICopilotSession>
  stop(): Promise<unknown>
  listModels?(): Promise<Array<{ id: string; name?: string }>>
}

/**
 * Lazily load the CopilotClient constructor.
 * Resolves the SDK from app/node_modules since the dependency is
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
 * Get a GitHub token for Copilot API access.
 *
 * Checks GITHUB_TOKEN env var first, then falls back to `gh auth token`.
 */
export function getGitHubToken(): string {
  const envToken = process.env.GITHUB_TOKEN
  if (envToken) {
    return envToken
  }

  try {
    const ghToken = execSync('gh auth token', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    if (ghToken) {
      return ghToken
    }
  } catch {
    // gh CLI not available or not authenticated
  }

  throw new Error(
    'No GitHub token found.\n' +
    'Set GITHUB_TOKEN env var or authenticate via `gh auth login`.\n' +
    'The token needs Copilot access.'
  )
}

/**
 * Create a CopilotClient instance for the given repository path.
 *
 * Uses the SDK's built-in CLI spawning — no Electron-specific path needed.
 */
export async function createCopilotClient(
  repositoryPath: string,
  token: string
): Promise<ICopilotClientInstance> {
  const ClientCtor = getCopilotClientConstructor()
  return new ClientCtor({
    cwd: repositoryPath,
    autoStart: true,
    githubToken: token,
    logLevel: 'warning',
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
