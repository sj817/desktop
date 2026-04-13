/**
 * Rebase conflict scenarios for the Copilot conflict resolution benchmark.
 *
 * These factories produce repos where an interactive rebase stops at the first
 * conflicting commit, leaving the working tree in a mid-rebase state that the
 * benchmark can feed to Copilot for resolution.
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

/** 20-line function used by the basic rebase scenario. */
function makeBasicFileContent(): string {
  return [
    'import { readFileSync } from "fs"',
    '',
    'interface ParseResult {',
    '  readonly headers: ReadonlyArray<string>',
    '  readonly rows: ReadonlyArray<ReadonlyArray<string>>',
    '}',
    '',
    'export function parseCsv(filePath: string): ParseResult {',
    '  const raw = readFileSync(filePath, "utf8")',
    '  const lines = raw.split("\\n").filter(l => l.trim().length > 0)',
    '',
    '  const headers = lines[0].split(",")',
    '  const rows: Array<ReadonlyArray<string>> = []',
    '',
    '  for (let i = 1; i < lines.length; i++) {',
    '    rows.push(lines[i].split(","))',
    '  }',
    '',
    '  return { headers, rows }',
    '}',
  ].join('\n')
}

/** 30-line function used by the multi-round rebase scenario. */
function makeMultiRoundFileContent(): string {
  return [
    'import { readFileSync, writeFileSync } from "fs"',
    'import { join } from "path"',
    '',
    'interface Config {',
    '  readonly port: number',
    '  readonly host: string',
    '  readonly debug: boolean',
    '  readonly maxRetries: number',
    '  readonly timeout: number',
    '}',
    '',
    'const DEFAULT_CONFIG: Config = {',
    '  port: 3000,',
    '  host: "localhost",',
    '  debug: false,',
    '  maxRetries: 3,',
    '  timeout: 30_000,',
    '}',
    '',
    'export function loadConfig(dir: string): Config {',
    '  const filePath = join(dir, "config.json")',
    '  const raw = readFileSync(filePath, "utf8")',
    '  const parsed = JSON.parse(raw) as Partial<Config>',
    '',
    '  return {',
    '    port: parsed.port ?? DEFAULT_CONFIG.port,',
    '    host: parsed.host ?? DEFAULT_CONFIG.host,',
    '    debug: parsed.debug ?? DEFAULT_CONFIG.debug,',
    '    maxRetries: parsed.maxRetries ?? DEFAULT_CONFIG.maxRetries,',
    '    timeout: parsed.timeout ?? DEFAULT_CONFIG.timeout,',
    '  }',
    '}',
    '',
    'export function saveConfig(dir: string, config: Config): void {',
    '  const filePath = join(dir, "config.json")',
    '  writeFileSync(filePath, JSON.stringify(config, null, 2))',
    '}',
    '',
    'export function mergeConfigs(',
    '  base: Config,',
    '  overrides: Partial<Config>',
    '): Config {',
    '  return {',
    '    port: overrides.port ?? base.port,',
    '    host: overrides.host ?? base.host,',
    '    debug: overrides.debug ?? base.debug,',
    '    maxRetries: overrides.maxRetries ?? base.maxRetries,',
    '    timeout: overrides.timeout ?? base.timeout,',
    '  }',
    '}',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const rebaseBasic: IScenarioFactory = {
  id: 'rebase-basic',
  description:
    'Rebase with one conflicting commit in a three-commit feature branch',
  tags: ['basic'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    const dir = join(tmpDir, 'rebase-basic')
    initRepo(dir)

    // Initial commit on main
    const filePath = join(dir, 'file.ts')
    writeFileSync(filePath, makeBasicFileContent())
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'initial: add parseCsv utility')

    // Create feature branch with 3 commits
    git(dir, 'checkout', '-b', 'feature')

    // Commit 1: modify the import (top of file — no overlap with main change)
    const c1 = makeBasicFileContent().replace(
      'import { readFileSync } from "fs"',
      'import { readFileSync, existsSync } from "fs"'
    )
    writeFileSync(filePath, c1)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: import existsSync')

    // Commit 2: modify the parsing loop (middle — this will conflict)
    const c2 = c1.replace(
      '    rows.push(lines[i].split(","))',
      '    const cells = lines[i].split(",").map(c => c.trim())\n    rows.push(cells)'
    )
    writeFileSync(filePath, c2)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: trim cell whitespace')

    // Commit 3: modify the return statement (bottom — no overlap)
    const c3 = c2.replace(
      '  return { headers, rows }',
      '  return { headers: headers.map(h => h.trim()), rows }'
    )
    writeFileSync(filePath, c3)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: trim header whitespace')

    // Switch to main and make a conflicting change in the same loop region
    git(dir, 'checkout', 'main')
    const mainContent = makeBasicFileContent().replace(
      '    rows.push(lines[i].split(","))',
      '    const values = lines[i].split(",").map(v => v.toLowerCase())\n    rows.push(values)'
    )
    writeFileSync(filePath, mainContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'refactor: normalize cell values to lowercase')

    // Attempt rebase — will stop at commit 2
    git(dir, 'checkout', 'feature')
    try {
      git(dir, 'rebase', 'main')
    } catch {
      // Expected: rebase stops at the conflicting commit
    }

    const conflictContent = readFileSync(filePath, 'utf8')
    const conflictedFiles: ReadonlyArray<IConflictedFile> = [
      { path: 'file.ts', content: conflictContent },
    ]

    return {
      id: 'rebase-basic',
      description: this.description,
      kind: 'rebase',
      repoPath: dir,
      conflictedFiles,
      fileCount: 1,
      ourBranch: 'feature',
      theirBranch: 'main',
      prMetadata: null,
      verifyCoherence: null,
      verifyIntent: null,
      tags: this.tags,
    }
  },
}

const rebaseMultiRound: IScenarioFactory = {
  id: 'rebase-multi-round',
  description:
    'Rebase with multiple conflicting commits across a five-commit feature branch',
  tags: ['basic'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    const dir = join(tmpDir, 'rebase-multi-round')
    initRepo(dir)

    // Initial commit on main
    const filePath = join(dir, 'file.ts')
    writeFileSync(filePath, makeMultiRoundFileContent())
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'initial: add config module')

    // Create feature branch with 5 commits
    git(dir, 'checkout', '-b', 'feature')

    // Commit 1: add a validation helper (bottom of file — no overlap)
    let content = readFileSync(filePath, 'utf8')
    content +=
      '\n\nexport function validatePort(port: number): boolean {\n  return port > 0 && port < 65536\n}\n'
    writeFileSync(filePath, content)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: add validatePort helper')

    // Commit 2: change DEFAULT_CONFIG values (will conflict)
    content = readFileSync(filePath, 'utf8')
    content = content
      .replace('  port: 3000,', '  port: 8080,')
      .replace('  debug: false,', '  debug: true,')
    writeFileSync(filePath, content)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: update default port and enable debug')

    // Commit 3: change loadConfig parsing logic (will conflict)
    content = readFileSync(filePath, 'utf8')
    content = content.replace(
      '  const parsed = JSON.parse(raw) as Partial<Config>',
      '  let parsed: Partial<Config>\n  try {\n    parsed = JSON.parse(raw) as Partial<Config>\n  } catch {\n    parsed = {}\n  }'
    )
    writeFileSync(filePath, content)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'feat: gracefully handle malformed config')

    // Commit 4: update saveConfig formatting (no overlap)
    content = readFileSync(filePath, 'utf8')
    content = content.replace(
      '  writeFileSync(filePath, JSON.stringify(config, null, 2))',
      '  const json = JSON.stringify(config, null, 2) + "\\n"\n  writeFileSync(filePath, json)'
    )
    writeFileSync(filePath, content)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'style: add trailing newline to saved config')

    // Commit 5: change mergeConfigs to use spread (will conflict)
    content = readFileSync(filePath, 'utf8')
    content = content.replace(
      [
        '  return {',
        '    port: overrides.port ?? base.port,',
        '    host: overrides.host ?? base.host,',
        '    debug: overrides.debug ?? base.debug,',
        '    maxRetries: overrides.maxRetries ?? base.maxRetries,',
        '    timeout: overrides.timeout ?? base.timeout,',
        '  }',
      ].join('\n'),
      '  return { ...base, ...overrides }'
    )
    writeFileSync(filePath, content)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'refactor: simplify mergeConfigs with spread')

    // Switch to main and make conflicting changes in regions 2, 3, and 5
    git(dir, 'checkout', 'main')
    let mainContent = readFileSync(filePath, 'utf8')

    // Overlap with commit 2: change DEFAULT_CONFIG differently
    mainContent = mainContent
      .replace('  port: 3000,', '  port: 4000,')
      .replace('  maxRetries: 3,', '  maxRetries: 5,')

    // Overlap with commit 3: change loadConfig parsing differently
    mainContent = mainContent.replace(
      '  const parsed = JSON.parse(raw) as Partial<Config>',
      '  const parsed = JSON.parse(raw.trim()) as Partial<Config>'
    )

    // Overlap with commit 5: change mergeConfigs differently
    mainContent = mainContent.replace(
      [
        '  return {',
        '    port: overrides.port ?? base.port,',
        '    host: overrides.host ?? base.host,',
        '    debug: overrides.debug ?? base.debug,',
        '    maxRetries: overrides.maxRetries ?? base.maxRetries,',
        '    timeout: overrides.timeout ?? base.timeout,',
        '  }',
      ].join('\n'),
      [
        '  return {',
        '    port: overrides.port !== undefined ? overrides.port : base.port,',
        '    host: overrides.host !== undefined ? overrides.host : base.host,',
        '    debug: overrides.debug !== undefined ? overrides.debug : base.debug,',
        '    maxRetries: overrides.maxRetries !== undefined ? overrides.maxRetries : base.maxRetries,',
        '    timeout: overrides.timeout !== undefined ? overrides.timeout : base.timeout,',
        '  }',
      ].join('\n')
    )

    writeFileSync(filePath, mainContent)
    git(dir, 'add', '.')
    git(
      dir,
      'commit',
      '-m',
      'refactor: adjust defaults, trim raw config, explicit undefined checks'
    )

    // Attempt rebase — will stop at commit 2 (the first conflict)
    git(dir, 'checkout', 'feature')
    try {
      git(dir, 'rebase', 'main')
    } catch {
      // Expected: rebase stops at the first conflicting commit
    }

    const conflictContent = readFileSync(filePath, 'utf8')
    const conflictedFiles: ReadonlyArray<IConflictedFile> = [
      { path: 'file.ts', content: conflictContent },
    ]

    return {
      id: 'rebase-multi-round',
      description: this.description,
      kind: 'rebase',
      repoPath: dir,
      conflictedFiles,
      fileCount: 1,
      ourBranch: 'feature',
      theirBranch: 'main',
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

export const rebaseScenarios: ReadonlyArray<IScenarioFactory> = [
  rebaseBasic,
  rebaseMultiRound,
]
