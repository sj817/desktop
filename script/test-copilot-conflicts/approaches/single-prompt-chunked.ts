/**
 * Approach 3: Single Prompt — Chunked Batching
 *
 * Splits conflicted files into chunks of ~25 files, sends each chunk as
 * an independent prompt (sequentially), and merges results. This extends
 * the single-prompt ceiling past 150 files while reducing latency at
 * large file counts (smaller prompts = faster responses).
 */

import { extname } from 'path'
import { ICopilotClientInstance } from './shared'
import {
  IGeneratedScenario,
  IResolutionResult,
  IResolutionResponse,
  IFileResolution,
  IConflictHunk,
  IConflictedFile,
} from '../types'
import { TokenTracker } from '../metrics/token-tracker'
import { LatencyTracker } from '../metrics/latency-tracker'

const CHUNK_SIZE = 25

// ---------------------------------------------------------------------------
// System prompt (same as single-prompt, with chunk-awareness)
// ---------------------------------------------------------------------------

const ChunkedSystemPrompt = `
You are an expert merge conflict resolver for a Git repository. Your task is to analyze merge conflicts and produce correct, clean resolutions.

IMPORTANT: You have all the context you need in the user message below. Do NOT attempt to use any tools. Do NOT try to read files, run commands, or call any functions. Respond ONLY with the JSON format specified at the end of these instructions.

You will receive:
- Branch names for both sides of the merge
- The conflict markers from each conflicted file (ours, theirs, and optionally base content)
- Context lines surrounding each conflict
- When available: recent commit messages from both branches explaining the intent behind changes
- When available: the pull request title and description providing higher-level context

Note: You may receive a SUBSET of all conflicted files. Resolve only the files provided. Other files are handled separately.

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
- Include one resolution entry per conflicted file provided
`

// ---------------------------------------------------------------------------
// Conflict extraction (shared with single-prompt.ts)
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

function formatChunkPrompt(
  ourBranch: string,
  theirBranch: string,
  files: ReadonlyArray<IConflictedFile>,
  chunkIndex: number,
  totalChunks: number,
  prMetadata: { title: string; body: string } | null,
  commitLog: string | null
): string {
  const parts: Array<string> = []

  parts.push(
    `Merge conflict between branch "${ourBranch}" (ours) and "${theirBranch}" (theirs).`
  )
  if (totalChunks > 1) {
    parts.push(`(Chunk ${chunkIndex + 1} of ${totalChunks} — resolve only these files)`)
  }
  parts.push('')

  for (const file of files) {
    const hunks = extractConflictHunks(file.content)
    if (hunks.length === 0) {
      continue
    }

    const ext = extname(file.path)
    const extStr = ext.startsWith('.') ? ext.slice(1) : ext

    parts.push(`## File: ${file.path}`)
    if (extStr) {
      parts.push(`Language hint: ${extStr}`)
    }
    parts.push('')

    for (let i = 0; i < hunks.length; i++) {
      const hunk = hunks[i]
      parts.push(`### Conflict ${i + 1} of ${hunks.length}`)
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

  if (prMetadata) {
    parts.push('## Pull Request Context')
    parts.push(`**Title:** ${prMetadata.title}`)
    parts.push(`**Description:** ${prMetadata.body}`)
    parts.push('')
  }

  if (commitLog) {
    parts.push('## Recent Commit History')
    parts.push('```')
    parts.push(commitLog)
    parts.push('```')
    parts.push('')
  }

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
 * Resolve conflicts using chunked single-prompt approach.
 *
 * Splits files into chunks of CHUNK_SIZE, sends each as an independent
 * prompt, and merges all resolutions. Each chunk gets its own session.
 */
export async function resolveSinglePromptChunked(
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
    // Get commit log once for all chunks
    let commitLog: string | null = null
    try {
      const { execSync } = require('child_process') as typeof import('child_process')
      commitLog = execSync(
        'git log --oneline -10 --all',
        { cwd: scenario.repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim() || null
    } catch {
      // Ignore
    }

    // Split files into chunks
    const files = [...scenario.conflictedFiles]
    const chunks: Array<ReadonlyArray<IConflictedFile>> = []
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      chunks.push(files.slice(i, i + CHUNK_SIZE))
    }

    const allResolutions: Array<IFileResolution> = []

    // Process each chunk sequentially (each gets its own session)
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]
      const prompt = formatChunkPrompt(
        scenario.ourBranch,
        scenario.theirBranch,
        chunk,
        ci,
        chunks.length,
        scenario.prMetadata,
        commitLog
      )

      const sessionConfig: Record<string, unknown> = {
        model,
        availableTools: [],
        systemMessage: {
          mode: 'append',
          content: ChunkedSystemPrompt,
        },
        onPermissionRequest: async () => ({
          kind: 'denied-interactively-by-user' as const,
        }),
      }

      const session = await client.createSession(sessionConfig)

      try {
        session.on('assistant.usage', tokenTracker.handleUsageEvent)

        const result = await session.sendAndWait(
          { prompt },
          600_000
        )

        if (!result) {
          throw new Error(`No response for chunk ${ci + 1}/${chunks.length}`)
        }

        const content = result.data?.content ?? ''
        if (!content) {
          throw new Error(`Empty response for chunk ${ci + 1}/${chunks.length}`)
        }

        const chunkResponse = parseResolutionResponse(content)
        allResolutions.push(...chunkResponse.resolutions)
      } finally {
        await session.destroy().catch(() => {})
      }
    }

    response = { resolutions: allResolutions }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  latencyTracker.stop()

  return {
    approach: 'single-prompt-chunked',
    scenarioId: scenario.id,
    model,
    response,
    error,
    tokenUsage: tokenTracker.getUsage(),
    latencyMs: latencyTracker.getElapsedMs(),
    toolCallCount: 0,
  }
}
