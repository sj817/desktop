/**
 * Cherry-pick conflict scenarios for the Copilot conflict resolution benchmark.
 *
 * These factories produce repos where a `git cherry-pick` leaves the working
 * tree in a conflicted state that the benchmark can feed to Copilot for
 * resolution.
 */

import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import {
  IConflictedFile,
  IGeneratedScenario,
  IScenarioFactory,
} from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(cwd: string, ...args: ReadonlyArray<string>): string {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function initRepo(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  git(dir, 'init')
  git(dir, 'config', 'user.email', 'bench@test.com')
  git(dir, 'config', 'user.name', 'Benchmark')
}

// ---------------------------------------------------------------------------
// File content generators
// ---------------------------------------------------------------------------

/** Utility module used by the basic cherry-pick scenario. */
function makeBasicUtilContent(): string {
  return [
    'export interface FormatOptions {',
    '  readonly precision: number',
    '  readonly locale: string',
    '  readonly currency: string',
    '}',
    '',
    'const DEFAULT_OPTIONS: FormatOptions = {',
    '  precision: 2,',
    '  locale: "en-US",',
    '  currency: "USD",',
    '}',
    '',
    'export function formatCurrency(',
    '  amount: number,',
    '  options: Partial<FormatOptions> = {}',
    '): string {',
    '  const opts = { ...DEFAULT_OPTIONS, ...options }',
    '  const fixed = amount.toFixed(opts.precision)',
    '  return `${opts.currency} ${fixed}`',
    '}',
    '',
    'export function parseCurrency(value: string): number {',
    '  const cleaned = value.replace(/[^0-9.-]/g, "")',
    '  return parseFloat(cleaned)',
    '}',
  ].join('\n')
}

/** Primary file used by the multi-file cherry-pick scenario. */
function makeMultiFileContent(): string {
  return [
    'export interface Logger {',
    '  readonly level: "debug" | "info" | "warn" | "error"',
    '  readonly prefix: string',
    '}',
    '',
    'export function createLogger(prefix: string): Logger {',
    '  return { level: "info", prefix }',
    '}',
    '',
    'export function formatMessage(logger: Logger, message: string): string {',
    '  const timestamp = new Date().toISOString()',
    '  return `[${timestamp}] [${logger.level}] ${logger.prefix}: ${message}`',
    '}',
    '',
    'export function shouldLog(',
    '  logger: Logger,',
    '  level: Logger["level"]',
    '): boolean {',
    '  const levels: ReadonlyArray<string> = ["debug", "info", "warn", "error"]',
    '  return levels.indexOf(level) >= levels.indexOf(logger.level)',
    '}',
  ].join('\n')
}

/** Helper file used by the multi-file cherry-pick scenario. */
function makeHelpersContent(): string {
  return [
    'import { Logger, formatMessage, shouldLog } from "./file"',
    '',
    'export function logDebug(logger: Logger, message: string): void {',
    '  if (shouldLog(logger, "debug")) {',
    '    console.log(formatMessage(logger, message))',
    '  }',
    '}',
    '',
    'export function logInfo(logger: Logger, message: string): void {',
    '  if (shouldLog(logger, "info")) {',
    '    console.log(formatMessage(logger, message))',
    '  }',
    '}',
    '',
    'export function logError(logger: Logger, message: string): void {',
    '  if (shouldLog(logger, "error")) {',
    '    console.error(formatMessage(logger, message))',
    '  }',
    '}',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const cherrypickBasic: IScenarioFactory = {
  id: 'cherrypick-basic',
  description:
    'Cherry-pick a single commit that conflicts with a diverged main branch',
  tags: ['basic'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    const dir = join(tmpDir, 'cherrypick-basic')
    initRepo(dir)

    // Initial commit on main
    const filePath = join(dir, 'file.ts')
    writeFileSync(filePath, makeBasicUtilContent())
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'initial: add currency formatting utilities')

    // Create feature branch and modify the formatCurrency function
    git(dir, 'checkout', '-b', 'feature')
    const featureContent = makeBasicUtilContent()
      .replace(
        '  const fixed = amount.toFixed(opts.precision)',
        '  const abs = Math.abs(amount)\n  const fixed = abs.toFixed(opts.precision)'
      )
      .replace(
        '  return `${opts.currency} ${fixed}`',
        '  const sign = amount < 0 ? "-" : ""\n  return `${sign}${opts.currency} ${fixed}`'
      )
    writeFileSync(filePath, featureContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: support negative currency values')

    // Switch to main and make a different modification to the same region
    git(dir, 'checkout', 'main')
    const mainContent = makeBasicUtilContent()
      .replace(
        '  const fixed = amount.toFixed(opts.precision)',
        '  const rounded = Math.round(amount * 10 ** opts.precision) / 10 ** opts.precision\n  const fixed = rounded.toFixed(opts.precision)'
      )
      .replace(
        '  return `${opts.currency} ${fixed}`',
        '  const formatted = new Intl.NumberFormat(opts.locale).format(parseFloat(fixed))\n  return `${opts.currency} ${formatted}`'
      )
    writeFileSync(filePath, mainContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'refactor: use Intl.NumberFormat for locale-aware formatting')

    // Cherry-pick the feature commit onto main
    try {
      git(dir, 'cherry-pick', 'feature')
    } catch {
      // Expected: cherry-pick fails due to conflict
    }

    const conflictContent = readFileSync(filePath, 'utf8')
    const conflictedFiles: ReadonlyArray<IConflictedFile> = [
      { path: 'file.ts', content: conflictContent },
    ]

    return {
      id: 'cherrypick-basic',
      description: this.description,
      kind: 'cherry-pick',
      repoPath: dir,
      conflictedFiles,
      fileCount: 1,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata: null,
      verifyCoherence: null,
      verifyIntent: null,
      tags: this.tags,
    }
  },
}

const cherrypickMulti: IScenarioFactory = {
  id: 'cherrypick-multi',
  description:
    'Cherry-pick a commit that causes conflicts in multiple files',
  tags: ['basic'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    const dir = join(tmpDir, 'cherrypick-multi')
    initRepo(dir)

    // Initial commit on main with two files
    const mainFilePath = join(dir, 'file.ts')
    const helpersPath = join(dir, 'helpers.ts')
    writeFileSync(mainFilePath, makeMultiFileContent())
    writeFileSync(helpersPath, makeHelpersContent())
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'initial: add logger module with helpers')

    // Create feature branch with 3 commits touching both files
    git(dir, 'checkout', '-b', 'feature')

    // Feature commit 1: change Logger interface and createLogger (both files affected)
    let fileContent = readFileSync(mainFilePath, 'utf8')
    fileContent = fileContent
      .replace(
        '  readonly level: "debug" | "info" | "warn" | "error"',
        '  readonly level: "trace" | "debug" | "info" | "warn" | "error"'
      )
      .replace(
        '  return { level: "info", prefix }',
        '  return { level: "info", prefix: `[${prefix}]` }'
      )
    let helpersContent = readFileSync(helpersPath, 'utf8')
    helpersContent = helpersContent.replace(
      'export function logDebug(logger: Logger, message: string): void {\n  if (shouldLog(logger, "debug")) {\n    console.log(formatMessage(logger, message))\n  }\n}',
      'export function logTrace(logger: Logger, message: string): void {\n  if (shouldLog(logger, "trace")) {\n    console.log(formatMessage(logger, message))\n  }\n}\n\nexport function logDebug(logger: Logger, message: string): void {\n  if (shouldLog(logger, "debug")) {\n    console.log(formatMessage(logger, message))\n  }\n}'
    )
    writeFileSync(mainFilePath, fileContent)
    writeFileSync(helpersPath, helpersContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: add trace log level')

    // Feature commit 2: modify formatMessage
    fileContent = readFileSync(mainFilePath, 'utf8')
    fileContent = fileContent.replace(
      '  return `[${timestamp}] [${logger.level}] ${logger.prefix}: ${message}`',
      '  const upperLevel = logger.level.toUpperCase()\n  return `[${timestamp}] [${upperLevel}] ${logger.prefix}: ${message}`'
    )
    writeFileSync(mainFilePath, fileContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: uppercase log level in output')

    // Feature commit 3: modify shouldLog and logError
    fileContent = readFileSync(mainFilePath, 'utf8')
    fileContent = fileContent.replace(
      '  const levels: ReadonlyArray<string> = ["debug", "info", "warn", "error"]',
      '  const levels: ReadonlyArray<string> = ["trace", "debug", "info", "warn", "error"]'
    )
    writeFileSync(mainFilePath, fileContent)
    helpersContent = readFileSync(helpersPath, 'utf8')
    helpersContent = helpersContent.replace(
      '    console.error(formatMessage(logger, message))',
      '    const output = formatMessage(logger, message)\n    console.error(output)\n    return output'
    )
    writeFileSync(helpersPath, helpersContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: update level ordering and return from logError')

    // Switch to main and make conflicting changes in overlapping regions
    git(dir, 'checkout', 'main')

    // Main changes to file.ts: different modification to createLogger and formatMessage
    let mainFileContent = readFileSync(mainFilePath, 'utf8')
    mainFileContent = mainFileContent
      .replace(
        '  return { level: "info", prefix }',
        '  return { level: "warn", prefix: prefix.trim() }'
      )
      .replace(
        '  return `[${timestamp}] [${logger.level}] ${logger.prefix}: ${message}`',
        '  return `${timestamp} | ${logger.level} | ${logger.prefix} | ${message}`'
      )
    writeFileSync(mainFilePath, mainFileContent)

    // Main changes to helpers.ts: different modification to logDebug
    let mainHelpersContent = readFileSync(helpersPath, 'utf8')
    mainHelpersContent = mainHelpersContent.replace(
      'export function logDebug(logger: Logger, message: string): void {\n  if (shouldLog(logger, "debug")) {\n    console.log(formatMessage(logger, message))\n  }\n}',
      'export function logDebug(logger: Logger, message: string): void {\n  if (shouldLog(logger, "debug")) {\n    const output = formatMessage(logger, message)\n    console.debug(output)\n  }\n}'
    )
    writeFileSync(mainFilePath, mainFileContent)
    writeFileSync(helpersPath, mainHelpersContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'refactor: adjust default level, reformat log output')

    // Cherry-pick the first feature commit (the one that touches both files)
    const hash = git(dir, 'rev-parse', 'feature~2').trim()
    try {
      git(dir, 'cherry-pick', hash)
    } catch {
      // Expected: cherry-pick fails due to conflicts
    }

    const conflictedFiles: Array<IConflictedFile> = []

    const fileConflict = readFileSync(mainFilePath, 'utf8')
    if (fileConflict.includes('<<<<<<<')) {
      conflictedFiles.push({ path: 'file.ts', content: fileConflict })
    }

    const helpersConflict = readFileSync(helpersPath, 'utf8')
    if (helpersConflict.includes('<<<<<<<')) {
      conflictedFiles.push({ path: 'helpers.ts', content: helpersConflict })
    }

    return {
      id: 'cherrypick-multi',
      description: this.description,
      kind: 'cherry-pick',
      repoPath: dir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata: null,
      verifyCoherence: null,
      verifyIntent: null,
      tags: this.tags,
    }
  },
}

// ---------------------------------------------------------------------------
// Exported factory list
// ---------------------------------------------------------------------------

export const cherrypickScenarios: ReadonlyArray<IScenarioFactory> = [
  cherrypickBasic,
  cherrypickMulti,
]
