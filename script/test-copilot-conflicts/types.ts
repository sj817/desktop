/**
 * Shared type definitions for the Copilot conflict resolution benchmark harness.
 *
 * These types define the interfaces between scenario generators, approach
 * implementations, metric collectors, and the report generator.
 */

// ---------------------------------------------------------------------------
// Scenario types
// ---------------------------------------------------------------------------

/** Metadata about a pull request, stored as .pr-metadata.json in test repos. */
export interface IPRMetadata {
  readonly title: string
  readonly body: string
}

/** A single conflicted file within a generated scenario. */
export interface IConflictedFile {
  /** Repository-relative file path */
  readonly path: string
  /** Full file content including conflict markers */
  readonly content: string
}

/** The type of git operation that produced the conflict. */
export type ConflictKind = 'merge' | 'rebase' | 'cherry-pick'

/**
 * A coherence verification function for adversarial scenarios.
 *
 * Given the map of resolved file paths → resolved content, returns true if
 * the resolutions are cross-file consistent.
 */
export type CoherenceVerifier = (resolutions: Map<string, string>) => boolean

/**
 * An intent verification function for scenarios with PR metadata.
 *
 * Given the map of resolved file paths → resolved content, returns true if
 * the resolutions follow the guidance from PR/commit context.
 */
export type IntentVerifier = (resolutions: Map<string, string>) => boolean

/** A fully generated conflict scenario ready for resolution. */
export interface IGeneratedScenario {
  /** Unique scenario identifier (e.g. 'merge-basic', 'adversarial-rename') */
  readonly id: string
  /** Human-readable scenario description */
  readonly description: string
  /** Type of git operation that produced the conflict */
  readonly kind: ConflictKind
  /** Path to the temporary git repository */
  readonly repoPath: string
  /** Files that contain conflict markers */
  readonly conflictedFiles: ReadonlyArray<IConflictedFile>
  /** Number of conflicted files (for scale tracking) */
  readonly fileCount: number
  /** Name of the current branch (ours) */
  readonly ourBranch: string
  /** Name of the incoming branch (theirs) */
  readonly theirBranch: string
  /** Optional PR metadata placed in the repo */
  readonly prMetadata: IPRMetadata | null
  /** Optional coherence verifier for adversarial scenarios */
  readonly verifyCoherence: CoherenceVerifier | null
  /** Optional intent verifier for PR/commit-aware scenarios */
  readonly verifyIntent: IntentVerifier | null
  /** Tags for filtering (e.g. 'adversarial', 'scale', 'basic') */
  readonly tags: ReadonlyArray<string>
}

/**
 * A scenario factory produces a GeneratedScenario inside a temporary
 * directory. The caller is responsible for cleanup.
 */
export interface IScenarioFactory {
  readonly id: string
  readonly description: string
  readonly tags: ReadonlyArray<string>
  generate(tmpDir: string): Promise<IGeneratedScenario>
}

// ---------------------------------------------------------------------------
// Resolution types (matches the Copilot SDK response schema)
// ---------------------------------------------------------------------------

/** Confidence level for a conflict resolution suggestion. */
export type ConflictResolutionConfidence = 'high' | 'medium' | 'low'

/** Resolution for a single conflicted file. */
export interface IFileResolution {
  readonly path: string
  readonly resolvedContent: string
  readonly reasoning: string
  readonly confidence: ConflictResolutionConfidence
}

/** Complete resolution response. */
export interface IResolutionResponse {
  readonly resolutions: ReadonlyArray<IFileResolution>
}

// ---------------------------------------------------------------------------
// Approach types
// ---------------------------------------------------------------------------

/** Identifier for a resolution approach. */
export type ApproachId = 'single-prompt' | 'agent-mode'

/** Token usage data from a single SDK interaction. */
export interface ITokenUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
  readonly cacheWriteTokens: number
  readonly model: string
}

/** Aggregate token usage across all interactions in a run. */
export interface IAggregateTokenUsage {
  readonly totalInputTokens: number
  readonly totalOutputTokens: number
  readonly totalCacheReadTokens: number
  readonly totalCacheWriteTokens: number
  readonly interactions: ReadonlyArray<ITokenUsage>
}

/** Result of running a single approach on a single scenario. */
export interface IResolutionResult {
  readonly approach: ApproachId
  readonly scenarioId: string
  readonly model: string
  readonly response: IResolutionResponse | null
  readonly error: string | null
  readonly tokenUsage: IAggregateTokenUsage
  readonly latencyMs: number
  readonly toolCallCount: number
}

// ---------------------------------------------------------------------------
// Accuracy types
// ---------------------------------------------------------------------------

/** Accuracy assessment for a single resolution result. */
export interface IAccuracyResult {
  /** No conflict markers (<<<, ===, >>>) remain in any resolved file */
  readonly markersRemoved: boolean
  /** Every conflicted file has a corresponding resolution */
  readonly allFilesResolved: boolean
  /** Resolved content parses as valid syntax (.ts/.js → TS parser, .json → JSON.parse) */
  readonly syntaxValid: boolean
  /** Adversarial cross-file coherence checks pass (null if not adversarial) */
  readonly crossFileCoherent: boolean | null
  /** PR/commit intent was respected (null if no intent verifier) */
  readonly intentRespected: boolean | null
  /** Overall score 0-100 */
  readonly score: number
  /** Detailed notes about failures */
  readonly notes: ReadonlyArray<string>
}

// ---------------------------------------------------------------------------
// Benchmark run types
// ---------------------------------------------------------------------------

/** A single benchmark data point: one approach × one scenario × one model. */
export interface IBenchmarkResult {
  readonly scenarioId: string
  readonly scenarioDescription: string
  readonly approach: ApproachId
  readonly model: string
  readonly fileCount: number
  readonly tags: ReadonlyArray<string>
  readonly resolution: IResolutionResult
  readonly accuracy: IAccuracyResult
  readonly timestamp: string
}

/** Complete results from a benchmark run. */
export interface IBenchmarkRun {
  readonly id: string
  readonly startTime: string
  readonly endTime: string
  readonly results: ReadonlyArray<IBenchmarkResult>
  readonly config: IBenchmarkConfig
}

/** Configuration for a benchmark run (from CLI args). */
export interface IBenchmarkConfig {
  readonly scenarios: ReadonlyArray<string> | 'all'
  readonly approaches: ReadonlyArray<ApproachId> | 'all'
  readonly scales: ReadonlyArray<number>
  readonly models: ReadonlyArray<string>
  readonly reportOnly: boolean
  readonly resultsDir: string
  readonly timeout: number
}

/** Default benchmark configuration. */
export const DEFAULT_CONFIG: IBenchmarkConfig = {
  scenarios: 'all',
  approaches: 'all',
  scales: [5, 15, 30],
  models: ['gpt-5-mini'],
  reportOnly: false,
  resultsDir: 'script/test-copilot-conflicts/results',
  timeout: 300_000,
}

// ---------------------------------------------------------------------------
// Conflict extraction types (self-contained, mirrors copilot-conflict-context)
// ---------------------------------------------------------------------------

/** A single conflict hunk extracted from a file with conflict markers. */
export interface IConflictHunk {
  readonly oursContent: string
  readonly theirsContent: string
  readonly baseContent: string | null
  readonly contextBefore: string
  readonly contextAfter: string
}

/** Conflict context for a single file. */
export interface IFileConflictContext {
  readonly path: string
  readonly hunks: ReadonlyArray<IConflictHunk>
  readonly extension: string
}

/** Full conflict context for a merge operation. */
export interface IConflictContext {
  readonly ourBranch: string
  readonly theirBranch: string
  readonly files: ReadonlyArray<IFileConflictContext>
}
