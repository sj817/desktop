/**
 * Types for Copilot-powered merge conflict resolution.
 *
 * NOTE: These types are defined locally for the UI layer. Once PR #21918
 * (response types and parser) merges, these should be replaced with imports
 * from that module to avoid duplication.
 */

/** Confidence level for a Copilot conflict resolution suggestion. */
export type ConflictResolutionConfidence = 'high' | 'medium' | 'low'

/** A single file's resolution as suggested by Copilot. */
export interface IFileResolution {
  /** The repo-relative path of the conflicted file. */
  readonly path: string

  /** The full resolved content for the file. */
  readonly resolvedContent: string

  /** A short, human-readable explanation of how Copilot resolved the conflict. */
  readonly reasoning: string

  /** Copilot's self-assessed confidence in this resolution. */
  readonly confidence: ConflictResolutionConfidence
}

/** The complete response from Copilot conflict resolution. */
export interface ICopilotConflictResolutionResponse {
  readonly resolutions: ReadonlyArray<IFileResolution>
}

const validConfidenceValues = new Set<string>(['high', 'medium', 'low'])

/** Typeguard for confidence values. */
export function isValidConfidence(
  value: string
): value is ConflictResolutionConfidence {
  return validConfidenceValues.has(value)
}

/**
 * Parse Copilot's raw response text into a typed resolution response.
 *
 * Handles optional markdown code fences around the JSON and validates that
 * every resolution has the required fields with the correct types.
 */
export function parseCopilotConflictResolution(
  content: string
): ICopilotConflictResolutionResponse {
  // Strip optional markdown code block wrappers
  let json = content.trim()
  const fenceMatch = json.match(/^```(?:json)?\s*\n([\s\S]*?)\n\s*```$/m)
  if (fenceMatch) {
    json = fenceMatch[1].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error(
      `Failed to parse Copilot conflict resolution response as JSON: ${json.slice(
        0,
        200
      )}`
    )
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).resolutions)
  ) {
    throw new Error(
      'Copilot conflict resolution response is missing "resolutions" array'
    )
  }

  const raw = (parsed as { resolutions: ReadonlyArray<unknown> }).resolutions
  const resolutions: Array<IFileResolution> = []

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Each resolution must be an object')
    }

    const r = item as Record<string, unknown>

    if (typeof r.path !== 'string' || r.path.length === 0) {
      throw new Error('Each resolution must have a non-empty "path" string')
    }
    if (typeof r.resolvedContent !== 'string') {
      throw new Error(
        `Resolution for "${r.path}" must have a "resolvedContent" string`
      )
    }
    if (typeof r.reasoning !== 'string') {
      throw new Error(
        `Resolution for "${r.path}" must have a "reasoning" string`
      )
    }
    if (typeof r.confidence !== 'string' || !isValidConfidence(r.confidence)) {
      throw new Error(
        `Resolution for "${r.path}" must have a valid "confidence" (high, medium, or low)`
      )
    }

    resolutions.push({
      path: r.path,
      resolvedContent: r.resolvedContent,
      reasoning: r.reasoning,
      confidence: r.confidence,
    })
  }

  if (resolutions.length === 0) {
    throw new Error('Copilot returned an empty resolutions array')
  }

  return { resolutions }
}
