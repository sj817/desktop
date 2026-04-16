/**
 * Approach 6: Unified Parallel — Smart Chunking with Dependency Grouping
 *
 * The "production-ready" approach:
 * 1. Scans for cross-file dependencies (shared imports/symbols)
 * 2. Groups dependent files together
 * 3. Splits into chunks of ~5 files (keeping dependency groups intact)
 * 4. Runs all chunks in parallel via Promise.all (single-prompt, no tools)
 * 5. Validates each chunk; retries failures once
 * 6. Falls back to pre-seeded agent for chunks that fail twice
 *
 * Target: ~25s latency at any file count, with high accuracy.
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

const TARGET_CHUNK_SIZE = 5
const MAX_CONCURRENCY = 5 // Max parallel SDK sessions to avoid memory exhaustion

// ---------------------------------------------------------------------------
// System prompt — identical to single-prompt but chunk-aware
// ---------------------------------------------------------------------------

const UnifiedSystemPrompt = `
You are an expert merge conflict resolver for a Git repository. Your task is to analyze merge conflicts and produce correct, clean resolutions.

IMPORTANT: You have all the context you need in the user message below. Do NOT attempt to use any tools. Do NOT try to read files, run commands, or call any functions. Respond ONLY with the JSON format specified at the end of these instructions.

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
- Include one resolution entry per conflicted file provided
`

// Agent fallback prompt for failed chunks
const AgentFallbackSystemPrompt = `
You are an expert merge conflict resolver. A previous attempt to resolve these conflicts produced invalid output. You have the conflict context below AND access to tools.

Use tools to verify cross-file dependencies if needed, then produce correct resolutions.

You MUST respond with valid JSON:
{
  "resolutions": [
    {
      "path": "relative/file/path.ts",
      "resolvedContent": "complete resolved file content",
      "reasoning": "explanation",
      "confidence": "high|medium|low"
    }
  ]
}

All conflict markers must be removed. Include one entry per file.
`

// ---------------------------------------------------------------------------
// Conflict extraction
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
// Dependency grouping — cluster files that share symbols/imports
// ---------------------------------------------------------------------------

/**
 * Extract exported and imported symbols from file content for dependency detection.
 */
function extractSymbols(content: string): {
  readonly exports: ReadonlySet<string>
  readonly imports: ReadonlySet<string>
  readonly references: ReadonlySet<string>
} {
  const exports = new Set<string>()
  const imports = new Set<string>()
  const references = new Set<string>()

  // Extract export names
  const exportMatches = content.matchAll(
    /export\s+(?:function|const|let|class|interface|type|enum)\s+(\w+)/g
  )
  for (const m of exportMatches) {
    exports.add(m[1])
  }

  // Extract import paths and named imports
  const importMatches = content.matchAll(
    /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g
  )
  for (const m of importMatches) {
    const namedImports = m[1] || m[2] || ''
    const importPath = m[3]
    imports.add(importPath)
    for (const name of namedImports.split(',')) {
      const trimmed = name.trim().split(/\s+as\s+/)[0].trim()
      if (trimmed) {
        references.add(trimmed)
      }
    }
  }

  // Extract referenced identifiers from conflict hunks (ours/theirs sections)
  // Look for variable/function/type references in the conflict content
  const identifierMatches = content.matchAll(
    /(?:extends|implements|instanceof|new|typeof)\s+(\w+)/g
  )
  for (const m of identifierMatches) {
    references.add(m[1])
  }

  return { exports, imports, references }
}

/**
 * Group files that share dependencies into clusters.
 * Files that import from each other or reference the same symbols
 * are placed in the same group.
 */
function groupByDependency(
  files: ReadonlyArray<IConflictedFile>
): ReadonlyArray<ReadonlyArray<IConflictedFile>> {
  if (files.length <= TARGET_CHUNK_SIZE) {
    return [files]
  }

  // Build symbol maps
  const fileSymbols = files.map(f => ({
    file: f,
    ...extractSymbols(f.content),
    baseName: f.path.replace(/\.[^.]+$/, '').replace(/^.*\//, ''),
  }))

  // Union-Find for clustering
  const parent = new Map<number, number>()
  function find(x: number): number {
    if (!parent.has(x)) {
      parent.set(x, x)
    }
    let p = parent.get(x)!
    while (p !== parent.get(p)!) {
      parent.set(p, parent.get(parent.get(p)!)!)
      p = parent.get(p)!
    }
    return p
  }
  function union(a: number, b: number): void {
    const pa = find(a)
    const pb = find(b)
    if (pa !== pb) {
      parent.set(pa, pb)
    }
  }

  // Initialize each file as its own group
  for (let i = 0; i < files.length; i++) {
    parent.set(i, i)
  }

  // Merge files that share dependencies
  for (let i = 0; i < fileSymbols.length; i++) {
    for (let j = i + 1; j < fileSymbols.length; j++) {
      const a = fileSymbols[i]
      const b = fileSymbols[j]

      // Check if file B imports from file A's path (or vice versa)
      const aImportsB = [...a.imports].some(
        imp => imp.includes(b.baseName)
      )
      const bImportsA = [...b.imports].some(
        imp => imp.includes(a.baseName)
      )

      // Check if they share exported/referenced symbols
      let sharedSymbols = false
      for (const exp of a.exports) {
        if (b.references.has(exp)) {
          sharedSymbols = true
          break
        }
      }
      if (!sharedSymbols) {
        for (const exp of b.exports) {
          if (a.references.has(exp)) {
            sharedSymbols = true
            break
          }
        }
      }

      if (aImportsB || bImportsA || sharedSymbols) {
        union(i, j)
      }
    }
  }

  // Collect groups
  const groups = new Map<number, Array<IConflictedFile>>()
  for (let i = 0; i < files.length; i++) {
    const root = find(i)
    if (!groups.has(root)) {
      groups.set(root, [])
    }
    groups.get(root)!.push(files[i])
  }

  // Split oversized groups into sub-chunks of TARGET_CHUNK_SIZE
  const result: Array<ReadonlyArray<IConflictedFile>> = []
  for (const group of groups.values()) {
    if (group.length <= TARGET_CHUNK_SIZE) {
      result.push(group)
    } else {
      for (let i = 0; i < group.length; i += TARGET_CHUNK_SIZE) {
        result.push(group.slice(i, i + TARGET_CHUNK_SIZE))
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Build prompt for a chunk
// ---------------------------------------------------------------------------

function buildChunkPrompt(
  scenario: IGeneratedScenario,
  files: ReadonlyArray<IConflictedFile>,
  commitLog: string | null
): string {
  const parts: Array<string> = []

  parts.push(
    `Merge conflict between branch "${scenario.ourBranch}" (ours) and "${scenario.theirBranch}" (theirs).`
  )
  parts.push(`Resolve these ${files.length} file(s):`)
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
      parts.push(`Language: ${extStr}`)
    }
    parts.push('')

    for (let i = 0; i < hunks.length; i++) {
      const hunk = hunks[i]
      parts.push(`### Conflict ${i + 1}/${hunks.length}`)

      if (hunk.contextBefore) {
        parts.push('Before:')
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
        parts.push('After:')
        parts.push('```')
        parts.push(hunk.contextAfter)
        parts.push('```')
      }
      parts.push('')
    }
  }

  if (scenario.prMetadata) {
    parts.push('## PR Context')
    parts.push(`**Title:** ${scenario.prMetadata.title}`)
    parts.push(`**Description:** ${scenario.prMetadata.body}`)
    parts.push('')
  }

  if (commitLog) {
    parts.push('## Commits')
    parts.push('```')
    parts.push(commitLog)
    parts.push('```')
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

  let jsonStr: string
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  } else {
    const objectMatch = content.match(/\{[\s\S]*"resolutions"[\s\S]*\}/)
    if (objectMatch) {
      jsonStr = objectMatch[0]
    } else {
      throw new Error('Response does not contain resolution JSON')
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Invalid JSON in resolution response')
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid resolution payload: expected an object')
  }

  const { resolutions } = parsed

  if (!Array.isArray(resolutions)) {
    throw new Error('"resolutions" must be an array')
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
// Chunk validation — check that output is usable
// ---------------------------------------------------------------------------

function validateChunkResult(
  response: IResolutionResponse,
  expectedFiles: ReadonlyArray<IConflictedFile>
): boolean {
  // Must have resolutions for all files
  if (response.resolutions.length < expectedFiles.length) {
    return false
  }

  for (const r of response.resolutions) {
    // No remaining conflict markers
    if (/^<{7}\s/m.test(r.resolvedContent)) {
      return false
    }
    if (/^>{7}\s/m.test(r.resolvedContent)) {
      return false
    }
    if (/^={7}$/m.test(r.resolvedContent)) {
      return false
    }
    // Content must not be empty
    if (r.resolvedContent.trim().length === 0) {
      return false
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Single chunk resolver (single-prompt, no tools)
// ---------------------------------------------------------------------------

async function resolveChunkSinglePrompt(
  client: ICopilotClientInstance,
  model: string,
  prompt: string,
  chunkTracker: TokenTracker
): Promise<IResolutionResponse> {
  const sessionConfig: Record<string, unknown> = {
    model,
    availableTools: [],
    systemMessage: {
      mode: 'append',
      content: UnifiedSystemPrompt,
    },
    onPermissionRequest: async () => ({
      kind: 'denied-interactively-by-user' as const,
    }),
  }

  const session = await client.createSession(sessionConfig)

  try {
    session.on('assistant.usage', chunkTracker.handleUsageEvent)

    const result = await session.sendAndWait(
      { prompt },
      600_000
    )

    if (!result?.data?.content) {
      throw new Error('No response from Copilot')
    }

    return parseResolutionResponse(result.data.content)
  } finally {
    await session.destroy().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Agent fallback for failed chunks
// ---------------------------------------------------------------------------

async function resolveChunkAgentFallback(
  client: ICopilotClientInstance,
  model: string,
  prompt: string,
  repoPath: string,
  chunkTracker: TokenTracker
): Promise<IResolutionResponse> {
  const sessionConfig: Record<string, unknown> = {
    model,
    systemMessage: {
      mode: 'append',
      content: AgentFallbackSystemPrompt,
    },
    workingDirectory: repoPath,
    onPermissionRequest: async () => ({
      kind: 'approved' as const,
    }),
  }

  const session = await client.createSession(sessionConfig)

  try {
    session.on('assistant.usage', chunkTracker.handleUsageEvent)

    const result = await session.sendAndWait(
      { prompt },
      600_000
    )

    if (!result?.data?.content) {
      throw new Error('No response from agent fallback')
    }

    return parseResolutionResponse(result.data.content)
  } finally {
    await session.destroy().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Main approach implementation
// ---------------------------------------------------------------------------

interface IChunkTask {
  readonly index: number
  readonly files: ReadonlyArray<IConflictedFile>
  readonly prompt: string
}

export async function resolveUnifiedParallel(
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
    // 1. Get commit log
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

    // 2. Group files by dependency
    const chunks = groupByDependency(scenario.conflictedFiles)

    // 3. Build prompts for each chunk
    const tasks: Array<IChunkTask> = chunks.map((files, index) => ({
      index,
      files,
      prompt: buildChunkPrompt(scenario, files, commitLog),
    }))

    // 4. Run chunks with bounded concurrency — each gets its own TokenTracker
    type ChunkResult = {
      readonly task: IChunkTask
      resolutions: ReadonlyArray<IFileResolution> | null
      error: string | null
      chunkTracker: TokenTracker
    }

    async function processChunk(task: IChunkTask): Promise<ChunkResult> {
      const chunkTracker = new TokenTracker()
      try {
        const result = await resolveChunkSinglePrompt(
          client, model, task.prompt, chunkTracker
        )

        // 5. Validate result
        if (validateChunkResult(result, task.files)) {
          return { task, resolutions: result.resolutions, error: null, chunkTracker }
        }

        // Validation failed — retry once with single prompt
        const retryResult = await resolveChunkSinglePrompt(
          client, model, task.prompt, chunkTracker
        )

        if (validateChunkResult(retryResult, task.files)) {
          return { task, resolutions: retryResult.resolutions, error: null, chunkTracker }
        }

        // 6. Fall back to agent mode for this chunk
        toolCallCount++
        const agentResult = await resolveChunkAgentFallback(
          client, model, task.prompt, scenario.repoPath, chunkTracker
        )
        return { task, resolutions: agentResult.resolutions, error: null, chunkTracker }
      } catch (e) {
        return {
          task,
          resolutions: null,
          error: e instanceof Error ? e.message : String(e),
          chunkTracker,
        }
      }
    }

    // Process in waves of MAX_CONCURRENCY
    const chunkResults: Array<ChunkResult> = []
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENCY) {
      const wave = tasks.slice(i, i + MAX_CONCURRENCY)
      const waveResults = await Promise.all(wave.map(processChunk))
      chunkResults.push(...waveResults)
    }

    // 7. Merge all resolutions and token usage
    const allResolutions: Array<IFileResolution> = []
    const errors: Array<string> = []

    for (const cr of chunkResults) {
      if (cr.resolutions) {
        allResolutions.push(...cr.resolutions)
      } else if (cr.error) {
        errors.push(`Chunk ${cr.task.index}: ${cr.error}`)
      }
      // Merge chunk token usage into the main tracker
      const chunkUsage = cr.chunkTracker.getUsage()
      for (const interaction of chunkUsage.interactions) {
        tokenTracker.recordUsage(interaction)
      }
    }

    if (allResolutions.length > 0) {
      response = { resolutions: allResolutions }
    }

    if (errors.length > 0 && allResolutions.length === 0) {
      error = errors.join('; ')
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  latencyTracker.stop()

  return {
    approach: 'unified-parallel',
    scenarioId: scenario.id,
    model,
    response,
    error,
    tokenUsage: tokenTracker.getUsage(),
    latencyMs: latencyTracker.getElapsedMs(),
    toolCallCount,
  }
}
