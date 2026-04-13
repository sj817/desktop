/**
 * Approach 1: Single Prompt
 *
 * Gathers all conflict context into a single formatted prompt, sends it
 * to the Copilot SDK via sendAndWait with no tool access, and parses
 * the structured JSON response.
 *
 * This mirrors the pattern from PR #21921's conflict resolution engine.
 */

import { extname } from 'path'
import { ICopilotClientInstance } from './shared'
import {
  IGeneratedScenario,
  IResolutionResult,
  IResolutionResponse,
  IConflictHunk,
  IFileConflictContext,
  IConflictContext,
} from '../types'
import { TokenTracker } from '../metrics/token-tracker'
import { LatencyTracker } from '../metrics/latency-tracker'

// ---------------------------------------------------------------------------
// System prompt (mirrors ConflictResolutionSystemPrompt from copilot-store.ts)
// ---------------------------------------------------------------------------

const ConflictResolutionSystemPrompt = `
You are an expert merge conflict resolver for a Git repository. Your task is to analyze merge conflicts and produce correct, clean resolutions.

You will receive:
- Branch names for both sides of the merge
- The conflict markers from each conflicted file (ours, theirs, and optionally base content)
- Context lines surrounding each conflict
- When available: recent commit messages from both branches explaining the intent behind changes
- When available: the pull request title and description providing higher-level context

Your job:
1. Understand the INTENT behind each side's changes using commit messages and PR context when available
2. Resolve each conflict by producing the correct merged content
3. Explain your reasoning for each resolution
4. Rate your confidence (high/medium/low)

Resolution guidelines:
- When both sides add complementary code (e.g., different imports, different functions), combine them
- When both sides modify the same code differently, use commit messages and PR context to determine the correct resolution
- When one side deletes code the other modifies, determine if the deletion was intentional
- Preserve code correctness: imports, types, formatting must be valid
- When in doubt, prefer the approach that maintains backward compatibility

You MUST respond with valid JSON in this exact format:
{
  "resolutions": [
    {
      "path": "relative/file/path.ts",
      "resolvedContent": "the complete resolved file content with all conflicts resolved",
      "reasoning": "explanation of how you resolved each conflict and why",
      "confidence": "high|medium|low"
    }
  ]
}

Important:
- resolvedContent must contain the COMPLETE file content (not just the conflicted sections)
- All conflict markers must be removed in the resolved content
- Include one resolution entry per conflicted file
`

// ---------------------------------------------------------------------------
// Conflict context extraction (mirrors copilot-conflict-context.ts)
// ---------------------------------------------------------------------------

const oursMarker = /^<{7}\s?/
const baseMarker = /^\|{7}\s?/
const separatorMarker = /^={7}$/
const theirsMarker = /^>{7}\s?/

/**
 * Extract conflict hunks from file content.
 */
function extractConflictHunks(
  fileContent: string,
  contextLines: number = 3
): ReadonlyArray<IConflictHunk> {
  const lines = fileContent.split('\n')
  const hunks: Array<IConflictHunk> = []

  let i = 0
  while (i < lines.length) {
    if (!oursMarker.test(lines[i])) {
      i++
      continue
    }

    const oursStart = i + 1
    const oursLines: Array<string> = []
    const baseLines: Array<string> = []
    let hasBase = false
    const theirsLines: Array<string> = []
    let hunkEnd = -1

    i = oursStart
    while (i < lines.length) {
      if (baseMarker.test(lines[i])) {
        hasBase = true
        i++
        break
      }
      if (separatorMarker.test(lines[i])) {
        i++
        break
      }
      oursLines.push(lines[i])
      i++
    }

    if (hasBase) {
      while (i < lines.length) {
        if (separatorMarker.test(lines[i])) {
          i++
          break
        }
        baseLines.push(lines[i])
        i++
      }
    }

    while (i < lines.length) {
      if (theirsMarker.test(lines[i])) {
        hunkEnd = i
        i++
        break
      }
      theirsLines.push(lines[i])
      i++
    }

    if (hunkEnd === -1) {
      continue
    }

    const markerStart = oursStart - 1
    const contextStart = Math.max(0, markerStart - contextLines)
    const contextEnd = Math.min(lines.length - 1, hunkEnd + contextLines)

    hunks.push({
      oursContent: oursLines.join('\n'),
      theirsContent: theirsLines.join('\n'),
      baseContent: hasBase ? baseLines.join('\n') : null,
      contextBefore: lines.slice(contextStart, markerStart).join('\n'),
      contextAfter: lines.slice(hunkEnd + 1, contextEnd + 1).join('\n'),
    })
  }

  return hunks
}

/**
 * Build conflict context from a generated scenario.
 */
function buildConflictContext(scenario: IGeneratedScenario): IConflictContext {
  const files: Array<IFileConflictContext> = []

  for (const file of scenario.conflictedFiles) {
    const hunks = extractConflictHunks(file.content)
    if (hunks.length === 0) {
      continue
    }

    const ext = extname(file.path)
    files.push({
      path: file.path,
      hunks,
      extension: ext.startsWith('.') ? ext.slice(1) : ext,
    })
  }

  return {
    ourBranch: scenario.ourBranch,
    theirBranch: scenario.theirBranch,
    files,
  }
}

/**
 * Format conflict context into a human-readable prompt string.
 */
function formatConflictContextForPrompt(context: IConflictContext): string {
  const parts: Array<string> = []

  parts.push(
    `Merge conflict between branch "${context.ourBranch}" (ours) and "${context.theirBranch}" (theirs).`
  )
  parts.push('')

  for (const file of context.files) {
    parts.push(`## File: ${file.path}`)
    if (file.extension) {
      parts.push(`Language hint: ${file.extension}`)
    }
    parts.push('')

    for (let i = 0; i < file.hunks.length; i++) {
      const hunk = file.hunks[i]
      parts.push(`### Conflict ${i + 1} of ${file.hunks.length}`)
      parts.push('')

      if (hunk.contextBefore) {
        parts.push('Context before:')
        parts.push('```')
        parts.push(hunk.contextBefore)
        parts.push('```')
        parts.push('')
      }

      parts.push('Ours (current branch):')
      parts.push('```')
      parts.push(hunk.oursContent)
      parts.push('```')
      parts.push('')

      if (hunk.baseContent !== null) {
        parts.push('Base (common ancestor):')
        parts.push('```')
        parts.push(hunk.baseContent)
        parts.push('```')
        parts.push('')
      }

      parts.push('Theirs (incoming branch):')
      parts.push('```')
      parts.push(hunk.theirsContent)
      parts.push('```')
      parts.push('')

      if (hunk.contextAfter) {
        parts.push('Context after:')
        parts.push('```')
        parts.push(hunk.contextAfter)
        parts.push('```')
        parts.push('')
      }
    }
  }

  return parts.join('\n')
}

/**
 * Add commit history context to the prompt.
 */
function addCommitContext(
  scenario: IGeneratedScenario,
  basePrompt: string
): string {
  const parts: Array<string> = [basePrompt]

  // Add PR metadata if available
  if (scenario.prMetadata) {
    parts.push('')
    parts.push('## Pull Request Context')
    parts.push(`**Title:** ${scenario.prMetadata.title}`)
    parts.push(`**Description:** ${scenario.prMetadata.body}`)
    parts.push('')
  }

  // Try to read recent commit messages from the repo
  try {
    const { execSync } = require('child_process') as typeof import('child_process')
    const log = execSync(
      'git log --oneline -10 --all',
      { cwd: scenario.repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    if (log.trim()) {
      parts.push('')
      parts.push('## Recent Commit History')
      parts.push('```')
      parts.push(log.trim())
      parts.push('```')
    }
  } catch {
    // Ignore if git log fails
  }

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Response parsing (mirrors copilot-conflict-resolution.ts)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse the Copilot response into a structured resolution.
 */
function parseResolutionResponse(content: string): IResolutionResponse {
  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)```/) ||
    content.match(/```\s*([\s\S]*?)```/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Copilot returned invalid JSON for conflict resolution')
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid conflict resolution payload: expected an object')
  }

  const { resolutions } = parsed

  if (!Array.isArray(resolutions)) {
    throw new Error('Invalid payload: "resolutions" must be an array')
  }

  return {
    resolutions: resolutions.map((entry: unknown, idx: number) => {
      if (!isRecord(entry)) {
        throw new Error(`Resolution at index ${idx} must be an object`)
      }

      const { path, resolvedContent, reasoning, confidence } = entry

      if (typeof path !== 'string' || path.trim().length === 0) {
        throw new Error(`"path" at index ${idx} must be a non-empty string`)
      }

      if (typeof resolvedContent !== 'string') {
        throw new Error(`"resolvedContent" at index ${idx} must be a string`)
      }

      return {
        path: path as string,
        resolvedContent: resolvedContent as string,
        reasoning: typeof reasoning === 'string' ? reasoning : '',
        confidence:
          typeof confidence === 'string' &&
          ['high', 'medium', 'low'].includes(confidence)
            ? (confidence as 'high' | 'medium' | 'low')
            : 'medium',
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Main approach implementation
// ---------------------------------------------------------------------------

/**
 * Resolve conflicts using a single prompt approach.
 *
 * Sends all conflict context as one formatted prompt to the SDK with
 * tool access denied, expecting a complete JSON response.
 */
export async function resolveSinglePrompt(
  client: ICopilotClientInstance,
  model: string,
  scenario: IGeneratedScenario,
  tokenTracker: TokenTracker,
  latencyTracker: LatencyTracker
): Promise<IResolutionResult> {
  latencyTracker.start()

  let response: IResolutionResponse | null = null
  let error: string | null = null

  try {
    const context = buildConflictContext(scenario)
    const basePrompt = formatConflictContextForPrompt(context)
    const fullPrompt = addCommitContext(scenario, basePrompt)

    const sessionConfig: Record<string, unknown> = {
      model,
      systemMessage: {
        mode: 'append',
        content: ConflictResolutionSystemPrompt,
      },
      onPermissionRequest: async () => ({
        kind: 'denied-interactively-by-user' as const,
      }),
    }

    const session = await client.createSession(sessionConfig)

    try {
      // Subscribe to usage events
      session.on('assistant.usage', tokenTracker.handleUsageEvent)

      const result = await session.sendAndWait(
        { prompt: fullPrompt },
        120_000 // 2 minute timeout for benchmark
      )

      if (!result?.data?.content) {
        throw new Error('No response from Copilot')
      }

      response = parseResolutionResponse(result.data.content)
    } finally {
      await session.destroy().catch(() => {})
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  latencyTracker.stop()

  return {
    approach: 'single-prompt',
    scenarioId: scenario.id,
    model,
    response,
    error,
    tokenUsage: tokenTracker.getUsage(),
    latencyMs: latencyTracker.getElapsedMs(),
    toolCallCount: 0, // Single prompt never uses tools
  }
}
