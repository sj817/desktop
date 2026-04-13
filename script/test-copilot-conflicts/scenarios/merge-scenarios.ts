/**
 * Merge conflict scenario factories.
 *
 * Each factory creates a real git repository with genuine merge conflicts
 * so the benchmark harness can evaluate Copilot's resolution quality.
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'

import {
  GeneratedScenario,
  ScenarioFactory,
  ConflictedFile,
  PRMetadata,
} from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(cwd: string, ...args: ReadonlyArray<string>): string {
  return execSync(`git ${args.join(' ')}`, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function initRepo(dir: string): void {
  git(dir, 'init')
  git(dir, 'config', 'user.email', '"bench@test.com"')
  git(dir, 'config', 'user.name', '"Benchmark"')
}

/** Read a file relative to a repo directory. */
function readFile(dir: string, filePath: string): string {
  return readFileSync(join(dir, filePath), 'utf8')
}

/** Write a file relative to a repo directory, creating parent dirs. */
function writeFile(dir: string, filePath: string, content: string): void {
  const fullPath = join(dir, filePath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content, 'utf8')
}

/** Collect all conflicted files by checking git status for unmerged paths. */
function collectConflictedFiles(dir: string): ReadonlyArray<ConflictedFile> {
  const status = git(dir, 'status', '--porcelain')
  const files: Array<ConflictedFile> = []

  for (const line of status.split('\n')) {
    // Unmerged paths show as UU, AA, DD, AU, UA, DU, UD
    const match = line.match(/^(?:UU|AA|DD|AU|UA|DU|UD)\s+(.+)$/)
    if (match) {
      const filePath = match[1].trim()
      const content = readFile(dir, filePath)
      files.push({ path: filePath, content })
    }
  }

  return files
}

// ---------------------------------------------------------------------------
// Scenario: merge-basic
// ---------------------------------------------------------------------------

const mergeBasic: ScenarioFactory = {
  id: 'merge-basic',
  description:
    'Simple single-file merge conflict in overlapping function bodies',
  tags: ['basic', 'scalable'],

  async generate(tmpDir: string): Promise<GeneratedScenario> {
    const dir = join(tmpDir, 'repo')
    mkdirSync(dir, { recursive: true })
    initRepo(dir)

    const originalContent = [
      'import { createHash } from "crypto"',
      '',
      'export function validateAuthToken(token: string): boolean {',
      '  if (!token || token.length === 0) {',
      '    return false',
      '  }',
      '  const parts = token.split(".")',
      '  if (parts.length !== 3) {',
      '    return false',
      '  }',
      '  const [header, payload, signature] = parts',
      '  const expectedSig = createHash("sha256")',
      '    .update(`${header}.${payload}`)',
      '    .digest("hex")',
      '  return signature === expectedSig',
      '}',
      '',
      'export function getTokenExpiry(token: string): Date | null {',
      '  try {',
      '    const payload = JSON.parse(',
      '      Buffer.from(token.split(".")[1], "base64").toString()',
      '    )',
      '    return payload.exp ? new Date(payload.exp * 1000) : null',
      '  } catch {',
      '    return null',
      '  }',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'file.ts', originalContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Initial auth module"')

    // Feature branch: refactor token handling to use HMAC
    git(dir, 'checkout', '-b', 'feature')

    const featureContent = [
      'import { createHmac } from "crypto"',
      '',
      'export function validateAuthToken(token: string): boolean {',
      '  if (!token || token.length === 0) {',
      '    return false',
      '  }',
      '  const parts = token.split(".")',
      '  if (parts.length !== 3) {',
      '    return false',
      '  }',
      '  const [header, payload, signature] = parts',
      '  const hmac = createHmac("sha256", process.env.AUTH_SECRET ?? "")',
      '  hmac.update(`${header}.${payload}`)',
      '  const expectedSig = hmac.digest("hex")',
      '  return signature === expectedSig',
      '}',
      '',
      'export function getTokenExpiry(token: string): Date | null {',
      '  try {',
      '    const payload = JSON.parse(',
      '      Buffer.from(token.split(".")[1], "base64").toString()',
      '    )',
      '    return payload.exp ? new Date(payload.exp * 1000) : null',
      '  } catch {',
      '    return null',
      '  }',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'file.ts', featureContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Refactor auth token handling"')

    // Main branch: optimize validation with caching
    git(dir, 'checkout', 'main')

    const mainContent = [
      'import { createHash } from "crypto"',
      '',
      'const validationCache = new Map<string, boolean>()',
      '',
      'export function validateAuthToken(token: string): boolean {',
      '  if (!token || token.length === 0) {',
      '    return false',
      '  }',
      '  const cached = validationCache.get(token)',
      '  if (cached !== undefined) {',
      '    return cached',
      '  }',
      '  const parts = token.split(".")',
      '  if (parts.length !== 3) {',
      '    return false',
      '  }',
      '  const [header, payload, signature] = parts',
      '  const expectedSig = createHash("sha256")',
      '    .update(`${header}.${payload}`)',
      '    .digest("hex")',
      '  const result = signature === expectedSig',
      '  validationCache.set(token, result)',
      '  return result',
      '}',
      '',
      'export function getTokenExpiry(token: string): Date | null {',
      '  try {',
      '    const payload = JSON.parse(',
      '      Buffer.from(token.split(".")[1], "base64").toString()',
      '    )',
      '    return payload.exp ? new Date(payload.exp * 1000) : null',
      '  } catch {',
      '    return null',
      '  }',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'file.ts', mainContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Optimize token validation"')

    try {
      git(dir, 'merge', 'feature')
    } catch {
      // Expected — the merge produces conflicts
    }

    const conflictedFiles = collectConflictedFiles(dir)

    return {
      id: 'merge-basic',
      description: this.description,
      kind: 'merge',
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
// Scenario: merge-multifile
// ---------------------------------------------------------------------------

const mergeMultifile: ScenarioFactory = {
  id: 'merge-multifile',
  description: 'Multi-file merge conflict across three independent modules',
  tags: ['basic', 'scalable'],

  async generate(tmpDir: string): Promise<GeneratedScenario> {
    const dir = join(tmpDir, 'repo')
    mkdirSync(dir, { recursive: true })
    initRepo(dir)

    const moduleA = [
      'export function formatUserName(',
      '  first: string,',
      '  last: string',
      '): string {',
      '  return `${first} ${last}`',
      '}',
      '',
      'export function parseFullName(name: string): {',
      '  first: string',
      '  last: string',
      '} {',
      '  const parts = name.split(" ")',
      '  return {',
      '    first: parts[0] ?? "",',
      '    last: parts.slice(1).join(" "),',
      '  }',
      '}',
      '',
    ].join('\n')

    const moduleB = [
      'export interface Logger {',
      '  info(message: string): void',
      '  error(message: string, err?: Error): void',
      '}',
      '',
      'export function createLogger(prefix: string): Logger {',
      '  return {',
      '    info(message: string) {',
      '      console.log(`[${prefix}] INFO: ${message}`)',
      '    },',
      '    error(message: string, err?: Error) {',
      '      console.error(`[${prefix}] ERROR: ${message}`, err)',
      '    },',
      '  }',
      '}',
      '',
    ].join('\n')

    const moduleC = [
      'export type CacheEntry<T> = {',
      '  readonly value: T',
      '  readonly expiresAt: number',
      '}',
      '',
      'export function createCache<T>(): {',
      '  get: (key: string) => T | undefined',
      '  set: (key: string, value: T, ttlMs: number) => void',
      '} {',
      '  const store = new Map<string, CacheEntry<T>>()',
      '  return {',
      '    get(key: string) {',
      '      const entry = store.get(key)',
      '      if (!entry) {',
      '        return undefined',
      '      }',
      '      if (Date.now() > entry.expiresAt) {',
      '        store.delete(key)',
      '        return undefined',
      '      }',
      '      return entry.value',
      '    },',
      '    set(key: string, value: T, ttlMs: number) {',
      '      store.set(key, { value, expiresAt: Date.now() + ttlMs })',
      '    },',
      '  }',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'module-a.ts', moduleA)
    writeFile(dir, 'module-b.ts', moduleB)
    writeFile(dir, 'module-c.ts', moduleC)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Add core modules"')

    // Feature branch: refactor all modules
    git(dir, 'checkout', '-b', 'feature')

    const featureModuleA = [
      'export function formatUserName(',
      '  first: string,',
      '  last: string,',
      '  options?: { uppercase?: boolean }',
      '): string {',
      '  const full = `${first} ${last}`',
      '  return options?.uppercase ? full.toUpperCase() : full',
      '}',
      '',
      'export function parseFullName(name: string): {',
      '  first: string',
      '  last: string',
      '} {',
      '  const trimmed = name.trim()',
      '  const parts = trimmed.split(/\\s+/)',
      '  return {',
      '    first: parts[0] ?? "",',
      '    last: parts.slice(1).join(" "),',
      '  }',
      '}',
      '',
    ].join('\n')

    const featureModuleB = [
      'export type LogLevel = "info" | "warn" | "error" | "debug"',
      '',
      'export interface Logger {',
      '  info(message: string): void',
      '  warn(message: string): void',
      '  error(message: string, err?: Error): void',
      '  debug(message: string): void',
      '}',
      '',
      'export function createLogger(prefix: string): Logger {',
      '  return {',
      '    info(message: string) {',
      '      console.log(`[${prefix}] INFO: ${message}`)',
      '    },',
      '    warn(message: string) {',
      '      console.warn(`[${prefix}] WARN: ${message}`)',
      '    },',
      '    error(message: string, err?: Error) {',
      '      console.error(`[${prefix}] ERROR: ${message}`, err)',
      '    },',
      '    debug(message: string) {',
      '      console.debug(`[${prefix}] DEBUG: ${message}`)',
      '    },',
      '  }',
      '}',
      '',
    ].join('\n')

    const featureModuleC = [
      'export type CacheEntry<T> = {',
      '  readonly value: T',
      '  readonly expiresAt: number',
      '  readonly createdAt: number',
      '}',
      '',
      'export function createCache<T>(): {',
      '  get: (key: string) => T | undefined',
      '  set: (key: string, value: T, ttlMs: number) => void',
      '  has: (key: string) => boolean',
      '} {',
      '  const store = new Map<string, CacheEntry<T>>()',
      '  return {',
      '    get(key: string) {',
      '      const entry = store.get(key)',
      '      if (!entry || Date.now() > entry.expiresAt) {',
      '        store.delete(key)',
      '        return undefined',
      '      }',
      '      return entry.value',
      '    },',
      '    set(key: string, value: T, ttlMs: number) {',
      '      store.set(key, {',
      '        value,',
      '        expiresAt: Date.now() + ttlMs,',
      '        createdAt: Date.now(),',
      '      })',
      '    },',
      '    has(key: string) {',
      '      const entry = store.get(key)',
      '      return !!entry && Date.now() <= entry.expiresAt',
      '    },',
      '  }',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'module-a.ts', featureModuleA)
    writeFile(dir, 'module-b.ts', featureModuleB)
    writeFile(dir, 'module-c.ts', featureModuleC)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Refactor modules with extended APIs"')

    // Main branch: different changes to same regions
    git(dir, 'checkout', 'main')

    const mainModuleA = [
      'export function formatUserName(',
      '  first: string,',
      '  last: string,',
      '  middleInitial?: string',
      '): string {',
      '  if (middleInitial) {',
      '    return `${first} ${middleInitial}. ${last}`',
      '  }',
      '  return `${first} ${last}`',
      '}',
      '',
      'export function parseFullName(name: string): {',
      '  first: string',
      '  last: string',
      '} {',
      '  const normalized = name.replace(/\\s+/g, " ").trim()',
      '  const parts = normalized.split(" ")',
      '  return {',
      '    first: parts[0] ?? "",',
      '    last: parts.slice(1).join(" "),',
      '  }',
      '}',
      '',
    ].join('\n')

    const mainModuleB = [
      'export interface Logger {',
      '  info(message: string): void',
      '  error(message: string, err?: Error): void',
      '  setLevel(level: "verbose" | "quiet"): void',
      '}',
      '',
      'export function createLogger(prefix: string): Logger {',
      '  let verbose = false',
      '  return {',
      '    info(message: string) {',
      '      if (verbose) {',
      '        console.log(`[${prefix}] ${new Date().toISOString()} INFO: ${message}`)',
      '      } else {',
      '        console.log(`[${prefix}] INFO: ${message}`)',
      '      }',
      '    },',
      '    error(message: string, err?: Error) {',
      '      console.error(`[${prefix}] ERROR: ${message}`, err?.stack ?? err)',
      '    },',
      '    setLevel(level: "verbose" | "quiet") {',
      '      verbose = level === "verbose"',
      '    },',
      '  }',
      '}',
      '',
    ].join('\n')

    const mainModuleC = [
      'export type CacheEntry<T> = {',
      '  readonly value: T',
      '  readonly expiresAt: number',
      '}',
      '',
      'export function createCache<T>(maxSize = 1000): {',
      '  get: (key: string) => T | undefined',
      '  set: (key: string, value: T, ttlMs: number) => void',
      '  clear: () => void',
      '} {',
      '  const store = new Map<string, CacheEntry<T>>()',
      '  return {',
      '    get(key: string) {',
      '      const entry = store.get(key)',
      '      if (!entry) {',
      '        return undefined',
      '      }',
      '      if (Date.now() > entry.expiresAt) {',
      '        store.delete(key)',
      '        return undefined',
      '      }',
      '      return entry.value',
      '    },',
      '    set(key: string, value: T, ttlMs: number) {',
      '      if (store.size >= maxSize) {',
      '        const oldest = store.keys().next().value',
      '        if (oldest !== undefined) {',
      '          store.delete(oldest)',
      '        }',
      '      }',
      '      store.set(key, { value, expiresAt: Date.now() + ttlMs })',
      '    },',
      '    clear() {',
      '      store.clear()',
      '    },',
      '  }',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'module-a.ts', mainModuleA)
    writeFile(dir, 'module-b.ts', mainModuleB)
    writeFile(dir, 'module-c.ts', mainModuleC)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Enhance modules with additional features"')

    try {
      git(dir, 'merge', 'feature')
    } catch {
      // Expected — the merge produces conflicts
    }

    const conflictedFiles = collectConflictedFiles(dir)

    return {
      id: 'merge-multifile',
      description: this.description,
      kind: 'merge',
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
// Scenario: merge-crossfile
// ---------------------------------------------------------------------------

const mergeCrossfile: ScenarioFactory = {
  id: 'merge-crossfile',
  description:
    'Cross-file rename conflict requiring coherent resolution across types and consumer',
  tags: ['adversarial'],

  async generate(tmpDir: string): Promise<GeneratedScenario> {
    const dir = join(tmpDir, 'repo')
    mkdirSync(dir, { recursive: true })
    initRepo(dir)

    const typesContent = [
      'export interface User {',
      '  userId: string',
      '  name: string',
      '  email: string',
      '}',
      '',
      'export interface Session {',
      '  token: string',
      '  user: User',
      '  expiresAt: Date',
      '}',
      '',
    ].join('\n')

    const consumerContent = [
      'import { User, Session } from "./types"',
      '',
      'export function formatUserDisplay(user: User): string {',
      '  return `${user.name} (${user.userId})`',
      '}',
      '',
      'export function isSessionValid(session: Session): boolean {',
      '  return session.expiresAt > new Date()',
      '}',
      '',
      'export function getUserId(user: User): string {',
      '  return user.userId',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'types.ts', typesContent)
    writeFile(dir, 'consumer.ts', consumerContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Add user types and consumer"')

    // Feature branch: rename userId → id
    git(dir, 'checkout', '-b', 'feature')

    const featureTypes = [
      'export interface User {',
      '  id: string',
      '  name: string',
      '  email: string',
      '}',
      '',
      'export interface Session {',
      '  token: string',
      '  user: User',
      '  expiresAt: Date',
      '}',
      '',
    ].join('\n')

    const featureConsumer = [
      'import { User, Session } from "./types"',
      '',
      'export function formatUserDisplay(user: User): string {',
      '  return `${user.name} (${user.id})`',
      '}',
      '',
      'export function isSessionValid(session: Session): boolean {',
      '  return session.expiresAt > new Date()',
      '}',
      '',
      'export function getUserId(user: User): string {',
      '  return user.id',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'types.ts', featureTypes)
    writeFile(dir, 'consumer.ts', featureConsumer)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Rename userId to id for consistency"')

    // Main branch: add new function that uses userId
    git(dir, 'checkout', 'main')

    const mainConsumer = [
      'import { User, Session } from "./types"',
      '',
      'export function formatUserDisplay(user: User): string {',
      '  return `${user.name} (${user.userId})`',
      '}',
      '',
      'export function isSessionValid(session: Session): boolean {',
      '  return session.expiresAt > new Date()',
      '}',
      '',
      'export function getUserId(user: User): string {',
      '  return user.userId',
      '}',
      '',
      'export function getUser(session: Session): {',
      '  id: string',
      '  displayName: string',
      '} {',
      '  return {',
      '    id: session.user.userId,',
      '    displayName: `${session.user.name} <${session.user.email}>`,',
      '  }',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'consumer.ts', mainConsumer)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Add getUser helper to consumer"')

    try {
      git(dir, 'merge', 'feature')
    } catch {
      // Expected — the merge produces conflicts
    }

    const conflictedFiles = collectConflictedFiles(dir)

    const verifyCoherence = (resolutions: Map<string, string>): boolean => {
      const typesResolved = resolutions.get('types.ts') ?? ''
      const consumerResolved = resolutions.get('consumer.ts') ?? ''

      // If types.ts uses `id` (not `userId`), consumer.ts must also use `id`
      const typesUsesId =
        typesResolved.includes('id: string') &&
        !typesResolved.includes('userId: string')

      if (typesUsesId) {
        // consumer.ts should not reference userId on the User interface
        return !consumerResolved.includes('user.userId')
      }

      // If types.ts still uses `userId`, consumer.ts should too
      return !consumerResolved.includes('user.id')
    }

    return {
      id: 'merge-crossfile',
      description: this.description,
      kind: 'merge',
      repoPath: dir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata: null,
      verifyCoherence,
      verifyIntent: null,
      tags: this.tags,
    }
  },
}

// ---------------------------------------------------------------------------
// Scenario: merge-adddelete
// ---------------------------------------------------------------------------

const mergeAddDelete: ScenarioFactory = {
  id: 'merge-adddelete',
  description: 'Add/delete conflict where one branch modifies a deleted file',
  tags: ['basic'],

  async generate(tmpDir: string): Promise<GeneratedScenario> {
    const dir = join(tmpDir, 'repo')
    mkdirSync(dir, { recursive: true })
    initRepo(dir)

    const moduleContent = [
      'import { readFileSync } from "fs"',
      '',
      '/** @deprecated Use the new config module instead. */',
      'export function loadLegacyConfig(path: string): Record<string, string> {',
      '  const raw = readFileSync(path, "utf8")',
      '  const config: Record<string, string> = {}',
      '  for (const line of raw.split("\\n")) {',
      '    const [key, value] = line.split("=")',
      '    if (key && value) {',
      '      config[key.trim()] = value.trim()',
      '    }',
      '  }',
      '  return config',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'old-module.ts', moduleContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Add legacy config module"')

    // Feature branch: delete the deprecated module
    git(dir, 'checkout', '-b', 'feature')
    git(dir, 'rm', 'old-module.ts')
    git(dir, 'commit', '-m', '"Remove deprecated legacy config module"')

    // Main branch: improve the module
    git(dir, 'checkout', 'main')

    const improvedContent = [
      'import { readFileSync, existsSync } from "fs"',
      '',
      '/** @deprecated Use the new config module instead. */',
      'export function loadLegacyConfig(path: string): Record<string, string> {',
      '  if (!existsSync(path)) {',
      '    throw new Error(`Config file not found: ${path}`)',
      '  }',
      '  const raw = readFileSync(path, "utf8")',
      '  const config: Record<string, string> = {}',
      '  for (const line of raw.split("\\n")) {',
      '    const trimmed = line.trim()',
      '    if (!trimmed || trimmed.startsWith("#")) {',
      '      continue',
      '    }',
      '    const eqIndex = trimmed.indexOf("=")',
      '    if (eqIndex > 0) {',
      '      config[trimmed.slice(0, eqIndex).trim()] = trimmed',
      '        .slice(eqIndex + 1)',
      '        .trim()',
      '    }',
      '  }',
      '  return config',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'old-module.ts', improvedContent)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Improve legacy config parser robustness"')

    try {
      git(dir, 'merge', 'feature')
    } catch {
      // Expected — the merge produces conflicts (add/delete)
    }

    const conflictedFiles = collectConflictedFiles(dir)

    return {
      id: 'merge-adddelete',
      description: this.description,
      kind: 'merge',
      repoPath: dir,
      conflictedFiles,
      fileCount: Math.max(conflictedFiles.length, 1),
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
// Scenario: merge-with-pr
// ---------------------------------------------------------------------------

const mergeWithPR: ScenarioFactory = {
  id: 'merge-with-pr',
  description:
    'Merge conflict with PR metadata guiding OAuth2 migration intent',
  tags: ['basic', 'intent'],

  async generate(tmpDir: string): Promise<GeneratedScenario> {
    const dir = join(tmpDir, 'repo')
    mkdirSync(dir, { recursive: true })
    initRepo(dir)

    const originalAuth = [
      'export interface AuthConfig {',
      '  apiToken: string',
      '  tokenEndpoint: string',
      '  refreshInterval: number',
      '}',
      '',
      'export function authenticate(config: AuthConfig): Promise<string> {',
      '  return fetch(config.tokenEndpoint, {',
      '    method: "POST",',
      '    headers: {',
      '      Authorization: `Bearer ${config.apiToken}`,',
      '      "Content-Type": "application/json",',
      '    },',
      '  })',
      '    .then(r => r.json())',
      '    .then(data => data.accessToken as string)',
      '}',
      '',
      'export function refreshToken(config: AuthConfig): Promise<string> {',
      '  return authenticate(config)',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'auth.ts', originalAuth)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Add legacy token auth module"')

    // Feature branch: migrate to OAuth2
    git(dir, 'checkout', '-b', 'feature')

    const oauth2Auth = [
      'export interface OAuth2Config {',
      '  clientId: string',
      '  clientSecret: string',
      '  oauth2TokenEndpoint: string',
      '  scopes: ReadonlyArray<string>',
      '}',
      '',
      'export function authenticate(config: OAuth2Config): Promise<string> {',
      '  const params = new URLSearchParams({',
      '    grant_type: "client_credentials",',
      '    client_id: config.clientId,',
      '    client_secret: config.clientSecret,',
      '    scope: config.scopes.join(" "),',
      '  })',
      '  return fetch(config.oauth2TokenEndpoint, {',
      '    method: "POST",',
      '    headers: { "Content-Type": "application/x-www-form-urlencoded" },',
      '    body: params.toString(),',
      '  })',
      '    .then(r => r.json())',
      '    .then(data => data.access_token as string)',
      '}',
      '',
      'export function refreshToken(',
      '  config: OAuth2Config,',
      '  currentToken: string',
      '): Promise<string> {',
      '  const params = new URLSearchParams({',
      '    grant_type: "refresh_token",',
      '    refresh_token: currentToken,',
      '    client_id: config.clientId,',
      '  })',
      '  return fetch(config.oauth2TokenEndpoint, {',
      '    method: "POST",',
      '    headers: { "Content-Type": "application/x-www-form-urlencoded" },',
      '    body: params.toString(),',
      '  })',
      '    .then(r => r.json())',
      '    .then(data => data.access_token as string)',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'auth.ts', oauth2Auth)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Replace legacy auth with OAuth2"')

    // Main branch: add validation to legacy auth
    git(dir, 'checkout', 'main')

    const enhancedLegacyAuth = [
      'export interface AuthConfig {',
      '  apiToken: string',
      '  tokenEndpoint: string',
      '  refreshInterval: number',
      '}',
      '',
      'function validateApiToken(token: string): boolean {',
      '  return token.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(token)',
      '}',
      '',
      'export function authenticate(config: AuthConfig): Promise<string> {',
      '  if (!validateApiToken(config.apiToken)) {',
      '    return Promise.reject(new Error("Invalid API token format"))',
      '  }',
      '  return fetch(config.tokenEndpoint, {',
      '    method: "POST",',
      '    headers: {',
      '      Authorization: `Bearer ${config.apiToken}`,',
      '      "Content-Type": "application/json",',
      '    },',
      '  })',
      '    .then(r => r.json())',
      '    .then(data => data.accessToken as string)',
      '}',
      '',
      'export function refreshToken(config: AuthConfig): Promise<string> {',
      '  return authenticate(config)',
      '}',
      '',
    ].join('\n')

    writeFile(dir, 'auth.ts', enhancedLegacyAuth)
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Add API token validation"')

    // Write PR metadata
    const prMetadata: PRMetadata = {
      title: 'Replace legacy auth with OAuth2',
      body:
        'This PR replaces legacy token authentication with OAuth2. ' +
        'The old apiToken field is deprecated and should be removed ' +
        'in favor of the new oauth2Token.',
    }
    writeFile(dir, '.pr-metadata.json', JSON.stringify(prMetadata, null, 2))
    git(dir, 'add', '.')
    git(dir, 'commit', '-m', '"Add PR metadata"')

    try {
      git(dir, 'merge', 'feature')
    } catch {
      // Expected — the merge produces conflicts
    }

    const conflictedFiles = collectConflictedFiles(dir)

    const verifyIntent = (resolutions: Map<string, string>): boolean => {
      const authResolved = resolutions.get('auth.ts') ?? ''
      const lower = authResolved.toLowerCase()

      // Resolution should favor OAuth2 per PR intent
      const hasOAuth2 = lower.includes('oauth2') || lower.includes('oauth2')
      const hasLegacyToken =
        lower.includes('apitoken') && !lower.includes('deprecated')

      return hasOAuth2 && !hasLegacyToken
    }

    return {
      id: 'merge-with-pr',
      description: this.description,
      kind: 'merge',
      repoPath: dir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata,
      verifyCoherence: null,
      verifyIntent,
      tags: this.tags,
    }
  },
}

// ---------------------------------------------------------------------------
// Exported factory list
// ---------------------------------------------------------------------------

export const mergeScenarios: ReadonlyArray<ScenarioFactory> = [
  mergeBasic,
  mergeMultifile,
  mergeCrossfile,
  mergeAddDelete,
  mergeWithPR,
]
