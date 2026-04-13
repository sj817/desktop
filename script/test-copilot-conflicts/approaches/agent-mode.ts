/**
 * Approach 2: Agent Mode
 *
 * Gives the Copilot SDK a high-level task prompt and enables all built-in
 * tools (bash, grep, file editor). The agent explores the repo itself —
 * reads files, runs git commands, and produces resolutions autonomously.
 */

import { ICopilotClientInstance } from './shared'
import {
  IGeneratedScenario,
  IResolutionResult,
  IResolutionResponse,
} from '../types'
import { TokenTracker } from '../metrics/token-tracker'
import { LatencyTracker } from '../metrics/latency-tracker'

// ---------------------------------------------------------------------------
// Agent system prompt
// ---------------------------------------------------------------------------

const AgentSystemPrompt = `
You are an expert merge conflict resolver. This repository has merge conflicts that need resolution.

Use the available tools to:
1. Understand the conflict by reading conflicted files and examining git history
2. Check commit messages (git log) to understand the intent behind each side's changes
3. Look for PR metadata in .pr-metadata.json if it exists
4. Resolve each conflict by understanding cross-file dependencies
5. Produce your final resolution as JSON

When analyzing conflicts:
- Read each conflicted file to understand the conflict markers
- Use git log to understand what each branch intended
- Check for cross-file dependencies (e.g., if a type is renamed in one file, usages in other files must be consistent)
- If .pr-metadata.json exists, use its title and body to understand the higher-level intent

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
// Response parsing
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse the agent's response to extract JSON resolution.
 *
 * The agent may produce a lot of tool output before the final JSON.
 * We look for the JSON in the final message content.
 */
function parseAgentResponse(content: string): IResolutionResponse {
  // Try to find JSON in code blocks first
  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)```/) ||
    content.match(/```\s*([\s\S]*?)```/)

  let jsonStr: string
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  } else {
    // Try to find a JSON object directly
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
 * Build the task prompt for the agent.
 *
 * Unlike the single-prompt approach, we don't feed conflict content directly.
 * Instead, we tell the agent which files are conflicted and let it explore.
 */
function buildAgentTaskPrompt(scenario: IGeneratedScenario): string {
  const parts: Array<string> = []

  parts.push(
    `This repository has ${scenario.kind} conflicts between ` +
    `branch "${scenario.ourBranch}" (ours/current) and ` +
    `"${scenario.theirBranch}" (theirs/incoming).`
  )
  parts.push('')
  parts.push('The following files have conflicts:')
  for (const file of scenario.conflictedFiles) {
    parts.push(`- ${file.path}`)
  }
  parts.push('')
  parts.push(
    'Please analyze each conflicted file, examine the git history to understand ' +
    'intent, check for .pr-metadata.json, and resolve all conflicts. ' +
    'Produce your resolution as JSON in the format specified in your system prompt.'
  )

  return parts.join('\n')
}

/**
 * Resolve conflicts using agent mode.
 *
 * Enables all SDK tools and lets the agent explore the repo autonomously
 * to understand and resolve conflicts.
 */
export async function resolveAgentMode(
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
    const taskPrompt = buildAgentTaskPrompt(scenario)

    const sessionConfig: Record<string, unknown> = {
      model,
      systemMessage: {
        mode: 'append',
        content: AgentSystemPrompt,
      },
      workingDirectory: scenario.repoPath,
      onPermissionRequest: async () => ({
        kind: 'approved' as const,
      }),
    }

    const session = await client.createSession(sessionConfig)

    try {
      // Subscribe to usage events
      session.on('assistant.usage', tokenTracker.handleUsageEvent)

      // Track tool calls
      session.on('tool.execution_start', () => {
        toolCallCount++
      })

      const result = await session.sendAndWait(
        { prompt: taskPrompt },
        300_000 // 5 minute timeout for agent mode
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
    approach: 'agent-mode',
    scenarioId: scenario.id,
    model,
    response,
    error,
    tokenUsage: tokenTracker.getUsage(),
    latencyMs: latencyTracker.getElapsedMs(),
    toolCallCount,
  }
}
