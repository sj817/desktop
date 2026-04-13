/**
 * Scale inflator for conflict scenarios.
 *
 * Takes a base scenario produced by any ScenarioFactory and inflates it to a
 * target file count by adding filler TypeScript files that each contain their
 * own merge conflict. This allows benchmarking resolution approaches at
 * different file-count scales without hand-authoring every file.
 */

import { execFileSync } from 'child_process'
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { rmSync } from 'fs'

import {
  IConflictedFile,
  IGeneratedScenario,
  IScenarioFactory,
} from '../types'

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function initRepo(cwd: string): void {
  git(cwd, 'init')
  git(cwd, 'config', 'user.email', 'bench@test.com')
  git(cwd, 'config', 'user.name', 'Benchmark')
}

// ---------------------------------------------------------------------------
// Filler file templates
// ---------------------------------------------------------------------------

function padIndex(index: number): string {
  return String(index).padStart(3, '0')
}

/** Base version of a filler file committed on both branches' common ancestor. */
function fillerBase(index: number): string {
  const pad = padIndex(index)
  return [
    `export function processItem${pad}(input: string): string {`,
    '  const trimmed = input.trim()',
    '  const normalized = trimmed.toLowerCase()',
    `  // Processing logic for item ${pad}`,
    '  if (normalized.length === 0) {',
    "    return 'empty'",
    '  }',
    '  return `processed-${normalized}`',
    '}',
    '',
    `export function validateItem${pad}(input: string): boolean {`,
    '  return input.length > 0 && input.length < 1000',
    '}',
    '',
  ].join('\n')
}

/** Feature-branch version: adds a parameter and changes the return value. */
function fillerFeature(index: number): string {
  const pad = padIndex(index)
  return [
    `export function processItem${pad}(input: string, prefix: string = 'feat'): string {`,
    '  const trimmed = input.trim()',
    '  const normalized = trimmed.toLowerCase()',
    `  // Processing logic for item ${pad} (feature branch)`,
    '  if (normalized.length === 0) {',
    "    return 'empty-feat'",
    '  }',
    '  return `${prefix}-${normalized}`',
    '}',
    '',
    `export function validateItem${pad}(input: string): boolean {`,
    '  return input.length > 0 && input.length < 2000',
    '}',
    '',
  ].join('\n')
}

/** Main-branch version: changes the processing logic differently. */
function fillerMain(index: number): string {
  const pad = padIndex(index)
  return [
    `export function processItem${pad}(input: string): string {`,
    '  const trimmed = input.trim()',
    '  const upper = trimmed.toUpperCase()',
    `  // Processing logic for item ${pad} (main branch)`,
    '  if (upper.length === 0) {',
    "    return 'empty-main'",
    '  }',
    '  return `main-${upper}`',
    '}',
    '',
    `export function validateItem${pad}(input: string): boolean {`,
    '  return input.trim().length > 0 && input.length <= 500',
    '}',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// File copying helpers
// ---------------------------------------------------------------------------

/** Copy all non-.git entries from src into dest. */
function copyRepoContents(src: string, dest: string): void {
  const entries = readdirSync(src)
  for (const entry of entries) {
    if (entry === '.git') {
      continue
    }
    cpSync(join(src, entry), join(dest, entry), { recursive: true })
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inflate a base scenario to `targetFileCount` conflicted files.
 *
 * Generates the base scenario, copies it into a fresh repo, adds filler
 * TypeScript files that each produce a merge conflict, then returns a new
 * GeneratedScenario with the combined conflicts.
 */
export async function inflateScenario(
  factory: IScenarioFactory,
  tmpDir: string,
  targetFileCount: number
): Promise<IGeneratedScenario> {
  // 1. Generate the base scenario in a subdirectory of tmpDir
  const baseDir = join(tmpDir, 'base')
  mkdirSync(baseDir, { recursive: true })
  const baseScenario = await factory.generate(baseDir)

  // 2. Create a new git repo in tmpDir
  initRepo(tmpDir)

  // 3. Copy all non-.git files from the base repo into the new repo
  copyRepoContents(baseScenario.repoPath, tmpDir)

  // 4. Add and commit the base state
  git(tmpDir, 'add', '-A')
  git(tmpDir, 'commit', '-m', '"Initial base state"')

  // 5. Determine filler count
  const fillerCount = targetFileCount - baseScenario.fileCount

  // 6. Create filler files with base content
  if (fillerCount > 0) {
    const fillerDir = join(tmpDir, 'filler')
    mkdirSync(fillerDir, { recursive: true })

    for (let i = 1; i <= fillerCount; i++) {
      const filename = `filler-${padIndex(i)}.ts`
      writeFileSync(join(fillerDir, filename), fillerBase(i))
    }

    // 7. Commit filler files on main
    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Add filler files"')
  }

  // 8. Create feature branch
  git(tmpDir, 'checkout', '-b', 'feature')

  // 9. On feature, modify each filler file
  if (fillerCount > 0) {
    const fillerDir = join(tmpDir, 'filler')
    for (let i = 1; i <= fillerCount; i++) {
      const filename = `filler-${padIndex(i)}.ts`
      writeFileSync(join(fillerDir, filename), fillerFeature(i))
    }

    // 10. Commit on feature
    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Feature branch filler changes"')
  }

  // 11. Switch to main, modify filler files differently
  git(tmpDir, 'checkout', 'main')

  if (fillerCount > 0) {
    const fillerDir = join(tmpDir, 'filler')
    for (let i = 1; i <= fillerCount; i++) {
      const filename = `filler-${padIndex(i)}.ts`
      writeFileSync(join(fillerDir, filename), fillerMain(i))
    }

    // 12. Commit on main
    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Main branch filler changes"')
  }

  // 13. Attempt the merge
  try {
    git(tmpDir, 'merge', 'feature', '--no-edit')
  } catch {
    // Expected to fail with conflicts
  }

  // 14. Read all conflicted files
  const conflictedOutput = git(tmpDir, 'diff', '--name-only', '--diff-filter=U')
  const conflictedPaths = conflictedOutput
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)

  const conflictedFiles: Array<IConflictedFile> = conflictedPaths.map(p => ({
    path: p,
    content: readFileSync(join(tmpDir, p), 'utf8'),
  }))

  // Clean up the base scenario's temp directory
  try {
    rmSync(baseDir, { recursive: true, force: true })
  } catch {
    // Best-effort cleanup
  }

  // 15. Return inflated scenario
  return {
    id: `${baseScenario.id}-x${targetFileCount}`,
    description: `${baseScenario.description} (scaled to ${targetFileCount} files)`,
    kind: baseScenario.kind,
    repoPath: tmpDir,
    conflictedFiles,
    fileCount: targetFileCount,
    ourBranch: 'main',
    theirBranch: 'feature',
    prMetadata: baseScenario.prMetadata,
    verifyCoherence: baseScenario.verifyCoherence,
    verifyIntent: baseScenario.verifyIntent,
    tags: [...baseScenario.tags, 'scaled'],
  }
}
