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
