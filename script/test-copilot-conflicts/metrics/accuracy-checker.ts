/**
 * Accuracy checker for conflict resolutions.
 *
 * Validates resolved content against multiple criteria:
 * - Conflict markers removed
 * - All files resolved
 * - Syntax validity
 * - Cross-file coherence (adversarial scenarios)
 * - Intent respected (PR metadata scenarios)
 */

import {
  IAccuracyResult,
  IGeneratedScenario,
  IResolutionResponse,
} from '../types'

const CONFLICT_MARKER_PATTERNS = [
  /^<{7}\s/m,
  /^={7}$/m,
  /^>{7}\s/m,
  /^\|{7}\s/m,
]

/**
 * Check if content contains any git conflict markers.
 */
function hasConflictMarkers(content: string): boolean {
  return CONFLICT_MARKER_PATTERNS.some(pattern => pattern.test(content))
}

/**
 * Attempt to validate TypeScript/JavaScript syntax by checking for
 * basic structural integrity. Uses the TypeScript compiler API if
 * available, otherwise falls back to heuristic checks.
 */
function validateTypeScriptSyntax(content: string): {
  valid: boolean
  error: string | null
} {
  try {
    // Try to use the TypeScript compiler API for real parsing
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ts = require('typescript') as typeof import('typescript')
    const sourceFile = ts.createSourceFile(
      'check.ts',
      content,
      ts.ScriptTarget.Latest,
      true
    )

    // Check for parse diagnostics
    const diagnostics = (sourceFile as unknown as Record<string, unknown>).parseDiagnostics as
      | ReadonlyArray<{ messageText: string | { messageText: string } }>
      | undefined

    if (diagnostics && diagnostics.length > 0) {
      const firstDiag = diagnostics[0]
      const msg =
        typeof firstDiag.messageText === 'string'
          ? firstDiag.messageText
          : firstDiag.messageText.messageText
      return { valid: false, error: msg }
    }

    return { valid: true, error: null }
  } catch {
    // TypeScript not available — fall back to heuristic checks
    return validateSyntaxHeuristic(content)
  }
}

/**
 * Heuristic syntax validation: check balanced braces, brackets, parens.
 */
function validateSyntaxHeuristic(content: string): {
  valid: boolean
  error: string | null
} {
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' }
  const closers = new Set(Object.values(pairs))
  const stack: Array<string> = []

  // Strip strings and comments to avoid false positives
  const stripped = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')

  for (const ch of stripped) {
    if (ch in pairs) {
      stack.push(pairs[ch])
    } else if (closers.has(ch)) {
      if (stack.length === 0 || stack.pop() !== ch) {
        return { valid: false, error: `Unmatched '${ch}'` }
      }
    }
  }

  if (stack.length > 0) {
    return { valid: false, error: `Unclosed '${stack[stack.length - 1]}'` }
  }

  return { valid: true, error: null }
}

/**
 * Validate JSON syntax.
 */
function validateJsonSyntax(content: string): {
  valid: boolean
  error: string | null
} {
  try {
    JSON.parse(content)
    return { valid: true, error: null }
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Invalid JSON',
    }
  }
}

/**
 * Validate syntax based on file extension.
 */
function validateSyntax(
  path: string,
  content: string
): { valid: boolean; error: string | null } {
  const ext = path.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return validateTypeScriptSyntax(content)
    case 'json':
      return validateJsonSyntax(content)
    default:
      // For unknown extensions, just check no conflict markers
      return { valid: true, error: null }
  }
}

/**
 * Assess the accuracy of a resolution against a scenario's expectations.
 */
export function checkAccuracy(
  scenario: IGeneratedScenario,
  resolution: IResolutionResponse | null
): IAccuracyResult {
  const notes: Array<string> = []
  let score = 0

  // No resolution at all
  if (resolution === null) {
    return {
      markersRemoved: false,
      allFilesResolved: false,
      syntaxValid: false,
      crossFileCoherent: scenario.verifyCoherence !== null ? false : null,
      intentRespected: scenario.verifyIntent !== null ? false : null,
      score: 0,
      notes: ['No resolution produced (error or timeout)'],
    }
  }

  const resolvedPaths = new Set(resolution.resolutions.map(r => r.path))
  const resolutionMap = new Map(
    resolution.resolutions.map(r => [r.path, r.resolvedContent])
  )

  // Check 1: All conflict markers removed (30 points)
  let markersRemoved = true
  for (const r of resolution.resolutions) {
    if (hasConflictMarkers(r.resolvedContent)) {
      markersRemoved = false
      notes.push(`Conflict markers remain in ${r.path}`)
    }
  }
  if (markersRemoved && resolution.resolutions.length > 0) {
    score += 30
  }

  // Check 2: All files resolved (20 points)
  let allFilesResolved = true
  for (const file of scenario.conflictedFiles) {
    if (!resolvedPaths.has(file.path)) {
      allFilesResolved = false
      notes.push(`Missing resolution for ${file.path}`)
    }
  }
  if (allFilesResolved && scenario.conflictedFiles.length > 0) {
    score += 20
  }

  // Gate remaining checks on having resolved at least some files
  if (resolution.resolutions.length === 0) {
    return {
      markersRemoved,
      allFilesResolved: false,
      syntaxValid: false,
      crossFileCoherent: scenario.verifyCoherence !== null ? false : null,
      intentRespected: scenario.verifyIntent !== null ? false : null,
      score: 0,
      notes: [...notes, 'No file resolutions provided'],
    }
  }

  // Check 3: Syntax valid (20 points)
  let syntaxValid = true
  for (const r of resolution.resolutions) {
    const result = validateSyntax(r.path, r.resolvedContent)
    if (!result.valid) {
      syntaxValid = false
      notes.push(`Syntax error in ${r.path}: ${result.error}`)
    }
  }
  if (syntaxValid) {
    score += 20
  }

  // Check 4: Cross-file coherence (15 points, adversarial only)
  let crossFileCoherent: boolean | null = null
  if (scenario.verifyCoherence !== null) {
    crossFileCoherent = scenario.verifyCoherence(resolutionMap)
    if (crossFileCoherent) {
      score += 15
    } else {
      notes.push('Cross-file coherence check failed')
    }
  } else {
    // Non-adversarial scenarios get full marks for coherence
    score += 15
  }

  // Check 5: Intent respected (15 points, intent scenarios only)
  let intentRespected: boolean | null = null
  if (scenario.verifyIntent !== null) {
    intentRespected = scenario.verifyIntent(resolutionMap)
    if (intentRespected) {
      score += 15
    } else {
      notes.push('Intent verification check failed')
    }
  } else {
    // Non-intent scenarios get full marks for intent
    score += 15
  }

  return {
    markersRemoved,
    allFilesResolved,
    syntaxValid,
    crossFileCoherent,
    intentRespected,
    score: Math.min(100, score),
    notes,
  }
}
