/**
 * Approach 4: Agent Mode — Pre-seeded Context
 *
 * Gives the agent the same curated conflict context as single-prompt
 * (conflict hunks, commit log, PR metadata) PLUS tool access for
 * verification and cross-file analysis. This eliminates the expensive
 * file-discovery phase while preserving the agent's ability to explore.
 */

import { extname } from 'path'
import { ICopilotClientInstance } from './shared'
import {
  IGeneratedScenario,
  IResolutionResult,
  IResolutionResponse,
  IConflictHunk,
} from '../types'
import { TokenTracker } from '../metrics/token-tracker'
import { LatencyTracker } from '../metrics/latency-tracker'

// ---------------------------------------------------------------------------
// System prompt — optimized for efficiency
// ---------------------------------------------------------------------------

const PreseededAgentSystemPrompt = `
You are an expert merge conflict resolver. You have been given all the conflict context below — do NOT re-read the conflicted files. The conflict content is already provided.

You MAY use tools for:
- Checking cross-file dependencies (e.g., grep for a renamed symbol across the repo)
- Reading .pr-metadata.json if mentioned but not provided
- Running a quick validation (e.g., checking that an import target exists)
- Any other verification that would improve resolution quality

But do NOT:
- Read files whose conflict content is already provided below — it's redundant
- Run 'cat' on every conflicted file — you already have the content
- Spend time on file discovery — the conflict list is complete

Work efficiently: analyze the provided conflicts, verify cross-file concerns if needed, then produce your resolution.

Resolution guidelines:
- When both sides add complementary code, combine them
- When both sides modify the same code differently, use commit and PR context to determine the correct resolution
- When one side deletes code the other modifies, determine if the deletion was intentional
- Preserve code correctness: imports, types, formatting must be valid

You MUST respond with your final answer as valid JSON in this format:
{
  "resolutions": [
    {
      "path": "relative/file/path.ts",
      "resolvedContent": "complete resolved file content",
      "reasoning": "explanation of resolution",
      "confidence": "high|medium|low"
    }
  ]
}

Important:
- resolvedContent must contain the COMPLETE file content with all conflicts resolved
- All conflict markers (<<<<<<, =======, >>>>>>>) must be removed
- Include one resolution entry per conflicted file
`

// ---------------------------------------------------------------------------
// Conflict extraction (shared logic)
// ---------------------------------------------------------------------------

const oursMarker = /^<{7}\s?/
const baseMarker = /^\|{7}\s?/
const separatorMarker = /^={7}$/
const theirsMarker = /^>{7}\s?/

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

// ---------------------------------------------------------------------------
// Build the pre-seeded task prompt
// ---------------------------------------------------------------------------

function buildPreseededTaskPrompt(scenario: IGeneratedScenario): string {
  const parts: Array<string> = []

  parts.push(
    `This repository has ${scenario.kind} conflicts between ` +
    `branch "${scenario.ourBranch}" (ours/current) and ` +
    `"${scenario.theirBranch}" (theirs/incoming).`
  )
  parts.push('')
  parts.push(`Total conflicted files: ${scenario.conflictedFiles.length}`)
  parts.push('')

  // Provide all conflict context upfront
  for (const file of scenario.conflictedFiles) {
    const hunks = extractConflictHunks(file.content)
    if (hunks.length === 0) {
      continue
    }

    const ext = extname(file.path)
    const extStr = ext.startsWith('.') ? ext.slice(1) : ext

    parts.push(`## File: ${file.path}`)
    if (extStr) {
      parts.push(`Language: ${extStr}`)
    }
    parts.push('')

    for (let i = 0; i < hunks.length; i++) {
      const hunk = hunks[i]
      parts.push(`### Conflict ${i + 1} of ${hunks.length}`)

      if (hunk.contextBefore) {
        parts.push('Context before:')
        parts.push('```')
        parts.push(hunk.contextBefore)
        parts.push('```')
      }

      parts.push('Ours:')
      parts.push('```')
      parts.push(hunk.oursContent)
      parts.push('```')

      if (hunk.baseContent !== null) {
        parts.push('Base:')
        parts.push('```')
        parts.push(hunk.baseContent)
        parts.push('```')
      }

      parts.push('Theirs:')
      parts.push('```')
      parts.push(hunk.theirsContent)
      parts.push('```')

      if (hunk.contextAfter) {
        parts.push('Context after:')
        parts.push('```')
        parts.push(hunk.contextAfter)
        parts.push('```')
      }
      parts.push('')
    }
  }

  // Add PR metadata
  if (scenario.prMetadata) {
    parts.push('## Pull Request Context')
    parts.push(`**Title:** ${scenario.prMetadata.title}`)
    parts.push(`**Description:** ${scenario.prMetadata.body}`)
    parts.push('')
  }

  // Add commit log
  try {
    const { execSync } = require('child_process') as typeof import('child_process')
    const log = execSync(
      'git log --oneline -10 --all',
      { cwd: scenario.repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    if (log.trim()) {
      parts.push('## Recent Commit History')
      parts.push('```')
      parts.push(log.trim())
      parts.push('```')
      parts.push('')
    }
  } catch {
    // Ignore
  }

  parts.push(
    'All conflict content is provided above. Use tools ONLY if you need to verify ' +
    'cross-file dependencies (e.g., grep for a renamed symbol). Do NOT re-read the ' +
    'files listed above. Resolve all conflicts and respond with the JSON format ' +
    'specified in your system prompt.'
  )

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseAgentResponse(content: string): IResolutionResponse {
  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)```/) ||
    content.match(/```\s*([\s\S]*?)```/)

  let jsonStr: string
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  } else {
    const objectMatch = content.match(/\{[\s\S]*"resolutions"[\s\S]*\}/)
    if (objectMatch) {
      jsonStr = objectMatch[0]
    } else {
      throw new Error('Agent response does not contain resolution JSON')
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Agent returned invalid JSON for conflict resolution')
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid resolution payload: expected an object')
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
 * Resolve conflicts using pre-seeded agent mode.
 *
 * Provides all conflict context upfront (like single-prompt) but also
 * enables tools for verification and cross-file analysis.
 */
export async function resolveAgentModePreseeded(
  client: ICopilotClientInstance,
  model: string,
  scenario: IGeneratedScenario,
  tokenTracker: TokenTracker,
  latencyTracker: LatencyTracker
): Promise<IResolutionResult> {
  latencyTracker.start()

  let response: IResolutionResponse | null = null
  let error: string | null = null
  let toolCallCount = 0

  try {
    const taskPrompt = buildPreseededTaskPrompt(scenario)

    const sessionConfig: Record<string, unknown> = {
      model,
      systemMessage: {
        mode: 'append',
        content: PreseededAgentSystemPrompt,
      },
      workingDirectory: scenario.repoPath,
      onPermissionRequest: async () => ({
        kind: 'approved' as const,
      }),
    }

    const session = await client.createSession(sessionConfig)

    try {
      session.on('assistant.usage', tokenTracker.handleUsageEvent)

      session.on('tool.execution_start', () => {
        toolCallCount++
      })

      const result = await session.sendAndWait(
        { prompt: taskPrompt },
        600_000 // 10 minute timeout (same as all approaches)
      )

      if (!result?.data?.content) {
        throw new Error('No response from Copilot agent')
      }

      response = parseAgentResponse(result.data.content)
    } finally {
      await session.destroy().catch(() => {})
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  latencyTracker.stop()

  return {
    approach: 'agent-mode-preseeded',
    scenarioId: scenario.id,
    model,
    response,
    error,
    tokenUsage: tokenTracker.getUsage(),
    latencyMs: latencyTracker.getElapsedMs(),
    toolCallCount,
  }
}
