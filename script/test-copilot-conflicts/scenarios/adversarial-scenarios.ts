/**
 * Adversarial conflict scenarios.
 *
 * These scenarios test cross-file coherence, PR intent, and subtle
 * conflict resolution challenges that require understanding beyond
 * individual files.
 */

import { execFileSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'

import { IGeneratedScenario, IScenarioFactory, IConflictedFile } from '../types'

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function initRepo(dir: string): void {
  git(dir, 'init', '-b', 'main')
  git(dir, 'config', 'user.email', 'bench@test.com')
  git(dir, 'config', 'user.name', 'Benchmark')
}

// ---------------------------------------------------------------------------
// adversarial-rename
// ---------------------------------------------------------------------------

const adversarialRename: IScenarioFactory = {
  id: 'adversarial-rename',
  description:
    'Rename userId→id in types.ts; consumer files must be consistent',
  tags: ['adversarial'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    initRepo(tmpDir)

    // Base files
    writeFileSync(
      join(tmpDir, 'types.ts'),
      `export type UserID = string

export interface User {
  userId: UserID
  name: string
  email: string
}

export interface UserProfile extends User {
  avatarUrl: string
}
`
    )

    writeFileSync(
      join(tmpDir, 'service.ts'),
      `import { User, UserID } from './types'

export function getUser(userId: UserID): User {
  // Fetch user by userId
  return {
    userId,
    name: 'Test User',
    email: 'test@example.com',
  }
}

export function listUsers(): User[] {
  return []
}
`
    )

    writeFileSync(
      join(tmpDir, 'handler.ts'),
      `import { User } from './types'
import { getUser } from './service'

export function handleGetUser(req: { params: { userId: string } }): User {
  const userId = req.params.userId
  return getUser(userId)
}

export function handleListUsers(): User[] {
  return []
}
`
    )

    writeFileSync(
      join(tmpDir, 'validator.ts'),
      `import { UserID } from './types'

export function isValidUserId(userId: UserID): boolean {
  return typeof userId === 'string' && userId.length > 0
}
`
    )

    writeFileSync(
      join(tmpDir, 'formatter.ts'),
      `import { User } from './types'

export function formatUser(user: User): string {
  return \`\${user.name} (userId: \${user.userId})\`
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Initial: User model with userId field"')

    // Feature branch: rename userId → id, UserID → UUID
    git(tmpDir, 'checkout', '-b', 'feature')

    writeFileSync(
      join(tmpDir, 'types.ts'),
      `export type UUID = string & { readonly __brand: 'UUID' }

export interface User {
  id: UUID
  name: string
  email: string
}

export interface UserProfile extends User {
  avatarUrl: string
}
`
    )

    writeFileSync(
      join(tmpDir, 'service.ts'),
      `import { User, UUID } from './types'

export function getUser(id: UUID): User {
  // Fetch user by id
  return {
    id,
    name: 'Test User',
    email: 'test@example.com',
  }
}

export function listUsers(): User[] {
  return []
}
`
    )

    writeFileSync(
      join(tmpDir, 'handler.ts'),
      `import { User, UUID } from './types'
import { getUser } from './service'

export function handleGetUser(req: { params: { id: string } }): User {
  const id = req.params.id as UUID
  return getUser(id)
}

export function handleListUsers(): User[] {
  return []
}
`
    )

    writeFileSync(
      join(tmpDir, 'validator.ts'),
      `import { UUID } from './types'

export function isValidId(id: UUID): boolean {
  return typeof id === 'string' && id.length > 0
}
`
    )

    writeFileSync(
      join(tmpDir, 'formatter.ts'),
      `import { User } from './types'

export function formatUser(user: User): string {
  return \`\${user.name} (id: \${user.id})\`
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Rename userId to id with UUID branded type"')

    // Main branch: add new usage of userId
    git(tmpDir, 'checkout', 'main')

    writeFileSync(
      join(tmpDir, 'service.ts'),
      `import { User, UserID } from './types'

export function getUser(userId: UserID): User {
  if (!userId) {
    throw new Error('userId is required')
  }
  return {
    userId,
    name: 'Test User',
    email: 'test@example.com',
  }
}

export function getUserByEmail(email: string): User | null {
  const users = listUsers()
  return users.find(u => u.email === email) ?? null
}

export function listUsers(): User[] {
  return []
}
`
    )

    writeFileSync(
      join(tmpDir, 'handler.ts'),
      `import { User } from './types'
import { getUser, getUserByEmail } from './service'

export function handleGetUser(req: { params: { userId: string } }): User {
  const userId = req.params.userId
  if (!userId) {
    throw new Error('Missing userId parameter')
  }
  return getUser(userId)
}

export function handleGetUserByEmail(req: { query: { email: string } }): User | null {
  return getUserByEmail(req.query.email)
}

export function handleListUsers(): User[] {
  return []
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Add getUserByEmail and lookup handler"')

    // Merge
    try {
      git(tmpDir, 'merge', 'feature')
    } catch {
      // Expected conflict
    }

    const conflictedFiles: Array<IConflictedFile> = []
    for (const path of [
      'types.ts',
      'service.ts',
      'handler.ts',
      'validator.ts',
      'formatter.ts',
    ]) {
      try {
        const content = readFileSync(join(tmpDir, path), 'utf8')
        if (content.includes('<<<<<<<')) {
          conflictedFiles.push({ path, content })
        }
      } catch {
        // File may not exist in conflict state
      }
    }

    return {
      id: 'adversarial-rename',
      description: this.description,
      kind: 'merge',
      repoPath: tmpDir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata: null,
      verifyCoherence: (resolutions: Map<string, string>): boolean => {
        // All files must use the same identifier: either all userId or all id
        const usesId = new Set<boolean>()
        for (const [, content] of resolutions) {
          // Check which pattern is used (ignoring comments and strings)
          const hasUserId = /\buserId\b/.test(content)
          const hasIdField =
            /\bid:\s*(UUID|string)/.test(content) ||
            /\buser\.id\b/.test(content) ||
            /\breq\.params\.id\b/.test(content)
          if (hasUserId) {
            usesId.add(false)
          }
          if (hasIdField) {
            usesId.add(true)
          }
        }
        // Should only use ONE naming convention
        return usesId.size <= 1
      },
      verifyIntent: null,
      tags: ['adversarial'],
    }
  },
}

// ---------------------------------------------------------------------------
// adversarial-interface
// ---------------------------------------------------------------------------

const adversarialInterface: IScenarioFactory = {
  id: 'adversarial-interface',
  description:
    'Both branches add different fields to interface; resolution must include both',
  tags: ['adversarial'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    initRepo(tmpDir)

    writeFileSync(
      join(tmpDir, 'interface.ts'),
      `export interface AuthConfig {
  baseUrl: string
  timeout: number
}

export function createDefaultConfig(): AuthConfig {
  return {
    baseUrl: 'https://api.example.com',
    timeout: 30000,
  }
}
`
    )

    writeFileSync(
      join(tmpDir, 'implementation.ts'),
      `import { AuthConfig, createDefaultConfig } from './interface'

export class AuthService {
  private config: AuthConfig

  constructor(config?: Partial<AuthConfig>) {
    this.config = { ...createDefaultConfig(), ...config }
  }

  getBaseUrl(): string {
    return this.config.baseUrl
  }

  getTimeout(): number {
    return this.config.timeout
  }
}
`
    )

    git(tmpDir, 'add', '-A')
    git(
      tmpDir,
      'commit',
      '-m',
      '"Initial AuthConfig interface and implementation"'
    )

    // Feature: add refreshToken
    git(tmpDir, 'checkout', '-b', 'feature')

    writeFileSync(
      join(tmpDir, 'interface.ts'),
      `export interface AuthConfig {
  baseUrl: string
  timeout: number
  refreshToken: string
}

export function createDefaultConfig(): AuthConfig {
  return {
    baseUrl: 'https://api.example.com',
    timeout: 30000,
    refreshToken: '',
  }
}
`
    )

    writeFileSync(
      join(tmpDir, 'implementation.ts'),
      `import { AuthConfig, createDefaultConfig } from './interface'

export class AuthService {
  private config: AuthConfig

  constructor(config?: Partial<AuthConfig>) {
    this.config = { ...createDefaultConfig(), ...config }
  }

  getBaseUrl(): string {
    return this.config.baseUrl
  }

  getTimeout(): number {
    return this.config.timeout
  }

  getRefreshToken(): string {
    return this.config.refreshToken
  }

  async refreshAuth(): Promise<void> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available')
    }
    // Refresh logic here
  }
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Add refreshToken support to AuthConfig"')

    // Main: add apiKey
    git(tmpDir, 'checkout', 'main')

    writeFileSync(
      join(tmpDir, 'interface.ts'),
      `export interface AuthConfig {
  baseUrl: string
  timeout: number
  apiKey: string
}

export function createDefaultConfig(): AuthConfig {
  return {
    baseUrl: 'https://api.example.com',
    timeout: 30000,
    apiKey: '',
  }
}
`
    )

    writeFileSync(
      join(tmpDir, 'implementation.ts'),
      `import { AuthConfig, createDefaultConfig } from './interface'

export class AuthService {
  private config: AuthConfig

  constructor(config?: Partial<AuthConfig>) {
    this.config = { ...createDefaultConfig(), ...config }
  }

  getBaseUrl(): string {
    return this.config.baseUrl
  }

  getTimeout(): number {
    return this.config.timeout
  }

  getApiKey(): string {
    return this.config.apiKey
  }

  validateApiKey(): boolean {
    return this.config.apiKey.length > 0
  }
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Add apiKey support to AuthConfig"')

    try {
      git(tmpDir, 'merge', 'feature')
    } catch {
      // Expected
    }

    const conflictedFiles: Array<IConflictedFile> = []
    for (const path of ['interface.ts', 'implementation.ts']) {
      const content = readFileSync(join(tmpDir, path), 'utf8')
      if (content.includes('<<<<<<<')) {
        conflictedFiles.push({ path, content })
      }
    }

    return {
      id: 'adversarial-interface',
      description: this.description,
      kind: 'merge',
      repoPath: tmpDir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata: null,
      verifyCoherence: (resolutions: Map<string, string>): boolean => {
        // Both refreshToken AND apiKey must appear in interface
        const ifaceContent = resolutions.get('interface.ts') ?? ''
        const implContent = resolutions.get('implementation.ts') ?? ''

        const hasRefreshToken =
          ifaceContent.includes('refreshToken') &&
          implContent.includes('refreshToken')
        const hasApiKey =
          ifaceContent.includes('apiKey') && implContent.includes('apiKey')

        return hasRefreshToken && hasApiKey
      },
      verifyIntent: null,
      tags: ['adversarial'],
    }
  },
}

// ---------------------------------------------------------------------------
// adversarial-import
// ---------------------------------------------------------------------------

const adversarialImport: IScenarioFactory = {
  id: 'adversarial-import',
  description: 'Both branches add same import; resolution must deduplicate',
  tags: ['adversarial'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    initRepo(tmpDir)

    writeFileSync(
      join(tmpDir, 'utils.ts'),
      `export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatCurrency(amount: number): string {
  return \`$\${amount.toFixed(2)}\`
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}
`
    )

    writeFileSync(
      join(tmpDir, 'consumer.ts'),
      `import { formatCurrency } from './utils'

export function renderPrice(amount: number): string {
  return formatCurrency(amount)
}

export function renderTotal(items: number[]): string {
  const total = items.reduce((sum, n) => sum + n, 0)
  return formatCurrency(total)
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Initial consumer with formatCurrency"')

    // Feature: add formatDate import and usage
    git(tmpDir, 'checkout', '-b', 'feature')

    writeFileSync(
      join(tmpDir, 'consumer.ts'),
      `import { formatDate } from './utils'
import { formatCurrency } from './utils'

export function renderPrice(amount: number): string {
  return formatCurrency(amount)
}

export function renderTotal(items: number[]): string {
  const total = items.reduce((sum, n) => sum + n, 0)
  return formatCurrency(total)
}

export function renderInvoiceDate(date: Date): string {
  return formatDate(date)
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Add formatDate import for invoice dates"')

    // Main: also add formatDate import (different position) and usage
    git(tmpDir, 'checkout', 'main')

    writeFileSync(
      join(tmpDir, 'consumer.ts'),
      `import { formatCurrency, formatDate } from './utils'

export function renderPrice(amount: number): string {
  return formatCurrency(amount)
}

export function renderTotal(items: number[]): string {
  const total = items.reduce((sum, n) => sum + n, 0)
  return formatCurrency(total)
}

export function renderCreatedDate(date: Date): string {
  return \`Created: \${formatDate(date)}\`
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Add formatDate import for created dates"')

    try {
      git(tmpDir, 'merge', 'feature')
    } catch {
      // Expected
    }

    const conflictedFiles: Array<IConflictedFile> = []
    const content = readFileSync(join(tmpDir, 'consumer.ts'), 'utf8')
    if (content.includes('<<<<<<<')) {
      conflictedFiles.push({ path: 'consumer.ts', content })
    }

    return {
      id: 'adversarial-import',
      description: this.description,
      kind: 'merge',
      repoPath: tmpDir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata: null,
      verifyCoherence: (resolutions: Map<string, string>): boolean => {
        const resolved = resolutions.get('consumer.ts') ?? ''
        // formatDate should appear in import lines exactly once
        const importLines = resolved
          .split('\n')
          .filter(l => l.trim().startsWith('import'))
        const formatDateImports = importLines.filter(l =>
          l.includes('formatDate')
        )
        return formatDateImports.length === 1
      },
      verifyIntent: null,
      tags: ['adversarial'],
    }
  },
}

// ---------------------------------------------------------------------------
// adversarial-pr-intent
// ---------------------------------------------------------------------------

const adversarialPrIntent: IScenarioFactory = {
  id: 'adversarial-pr-intent',
  description:
    'PR says replace legacy auth with OAuth2; resolution must prefer OAuth2',
  tags: ['adversarial', 'intent'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    initRepo(tmpDir)

    writeFileSync(
      join(tmpDir, 'auth.ts'),
      `export interface AuthCredentials {
  apiToken: string
}

export function authenticate(credentials: AuthCredentials): boolean {
  if (!credentials.apiToken) {
    return false
  }
  // Legacy token validation
  return credentials.apiToken.startsWith('tok_')
}

export function getAuthHeader(credentials: AuthCredentials): string {
  return \`Bearer \${credentials.apiToken}\`
}
`
    )

    writeFileSync(
      join(tmpDir, 'config.ts'),
      `import { AuthCredentials } from './auth'

export interface AppConfig {
  auth: AuthCredentials
  apiUrl: string
}

export function createConfig(token: string): AppConfig {
  return {
    auth: { apiToken: token },
    apiUrl: 'https://api.example.com',
  }
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Initial legacy auth system"')

    // Feature: replace with OAuth2
    git(tmpDir, 'checkout', '-b', 'feature')

    writeFileSync(
      join(tmpDir, 'auth.ts'),
      `export interface AuthCredentials {
  oauth2Token: string
  refreshToken: string
  expiresAt: number
}

export function authenticate(credentials: AuthCredentials): boolean {
  if (!credentials.oauth2Token) {
    return false
  }
  // Check if token is expired
  if (Date.now() > credentials.expiresAt) {
    return false
  }
  return true
}

export function getAuthHeader(credentials: AuthCredentials): string {
  return \`Bearer \${credentials.oauth2Token}\`
}

export async function refreshAuth(credentials: AuthCredentials): Promise<AuthCredentials> {
  // Use refresh token to get new access token
  const newToken = await exchangeRefreshToken(credentials.refreshToken)
  return {
    ...credentials,
    oauth2Token: newToken.accessToken,
    expiresAt: Date.now() + newToken.expiresIn * 1000,
  }
}

async function exchangeRefreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  // OAuth2 token exchange
  void refreshToken
  return { accessToken: 'new_token', expiresIn: 3600 }
}
`
    )

    writeFileSync(
      join(tmpDir, 'config.ts'),
      `import { AuthCredentials } from './auth'

export interface AppConfig {
  auth: AuthCredentials
  apiUrl: string
}

export function createConfig(oauth2Token: string, refreshToken: string): AppConfig {
  return {
    auth: {
      oauth2Token,
      refreshToken,
      expiresAt: Date.now() + 3600000,
    },
    apiUrl: 'https://api.example.com',
  }
}
`
    )

    // PR metadata
    writeFileSync(
      join(tmpDir, '.pr-metadata.json'),
      JSON.stringify(
        {
          title: 'Replace legacy auth with OAuth2',
          body: 'This PR replaces legacy token authentication with OAuth2 flow. The old apiToken field is deprecated and should be removed. All consumers should use oauth2Token going forward.',
        },
        null,
        2
      )
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Replace legacy token auth with OAuth2 flow"')

    // Main: modify the authenticate function (same lines feature changes)
    git(tmpDir, 'checkout', 'main')

    writeFileSync(
      join(tmpDir, 'auth.ts'),
      `export interface AuthCredentials {
  apiToken: string
  tokenExpiry: number
}

export function authenticate(credentials: AuthCredentials): boolean {
  if (!credentials.apiToken) {
    return false
  }
  // Enhanced legacy token validation with expiry check
  if (credentials.tokenExpiry && Date.now() > credentials.tokenExpiry) {
    return false
  }
  return credentials.apiToken.startsWith('tok_') && credentials.apiToken.length >= 10
}

export function getAuthHeader(credentials: AuthCredentials): string {
  return \`Bearer \${credentials.apiToken}\`
}

export function validateApiToken(token: string): { valid: boolean; reason: string } {
  if (!token) {
    return { valid: false, reason: 'Token is empty' }
  }
  if (!token.startsWith('tok_')) {
    return { valid: false, reason: 'Token must start with tok_' }
  }
  if (token.length < 10) {
    return { valid: false, reason: 'Token too short' }
  }
  return { valid: true, reason: '' }
}
`
    )

    writeFileSync(
      join(tmpDir, 'config.ts'),
      `import { AuthCredentials } from './auth'

export interface AppConfig {
  auth: AuthCredentials
  apiUrl: string
}

export function createConfig(token: string, expiry: number): AppConfig {
  return {
    auth: { apiToken: token, tokenExpiry: expiry },
    apiUrl: 'https://api.example.com',
  }
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Add apiToken validation helper"')

    try {
      git(tmpDir, 'merge', 'feature')
    } catch {
      // Expected
    }

    const conflictedFiles: Array<IConflictedFile> = []
    for (const path of ['auth.ts', 'config.ts']) {
      const content = readFileSync(join(tmpDir, path), 'utf8')
      if (content.includes('<<<<<<<')) {
        conflictedFiles.push({ path, content })
      }
    }

    // Read PR metadata
    const prMetadata = JSON.parse(
      readFileSync(join(tmpDir, '.pr-metadata.json'), 'utf8')
    )

    return {
      id: 'adversarial-pr-intent',
      description: this.description,
      kind: 'merge',
      repoPath: tmpDir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata,
      verifyCoherence: null,
      verifyIntent: (resolutions: Map<string, string>): boolean => {
        // Resolution should prefer OAuth2 and not contain legacy apiToken
        const authContent = resolutions.get('auth.ts') ?? ''

        const hasOAuth2 =
          authContent.includes('oauth2Token') || authContent.includes('OAuth2')
        // apiToken should NOT appear in the resolved code (except maybe comments)
        const lines = authContent
          .split('\n')
          .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        const hasLegacyToken = lines.some(l => l.includes('apiToken'))

        return hasOAuth2 && !hasLegacyToken
      },
      tags: ['adversarial', 'intent'],
    }
  },
}

// ---------------------------------------------------------------------------
// adversarial-delete-modify
// ---------------------------------------------------------------------------

const adversarialDeleteModify: IScenarioFactory = {
  id: 'adversarial-delete-modify',
  description:
    'Branch A deletes deprecated function, Branch B modifies it; deletion should win',
  tags: ['adversarial'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    initRepo(tmpDir)

    writeFileSync(
      join(tmpDir, 'helpers.ts'),
      `/**
 * Active helper function — still in use.
 */
export function activeHelper(input: string): string {
  return input.trim().toLowerCase()
}

/**
 * @deprecated Scheduled for removal in v3.0
 */
export function deprecatedHelper(value: string | null): string {
  if (value === null) {
    return 'default'
  }
  return value.toString()
}

export function anotherHelper(n: number): number {
  return n * 2
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Initial helpers with deprecated function"')

    // Feature: remove deprecated function
    git(tmpDir, 'checkout', '-b', 'feature')

    writeFileSync(
      join(tmpDir, 'helpers.ts'),
      `/**
 * Active helper function — still in use.
 */
export function activeHelper(input: string): string {
  return input.trim().toLowerCase()
}

export function anotherHelper(n: number): number {
  return n * 2
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Remove deprecated helper per cleanup plan"')

    // Main: modify deprecated function
    git(tmpDir, 'checkout', 'main')

    writeFileSync(
      join(tmpDir, 'helpers.ts'),
      `/**
 * Active helper function — still in use.
 */
export function activeHelper(input: string): string {
  return input.trim().toLowerCase()
}

/**
 * @deprecated Scheduled for removal in v3.0
 */
export function deprecatedHelper(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'default'
  }
  const trimmed = value.toString().trim()
  return trimmed.length > 0 ? trimmed : 'default'
}

export function anotherHelper(n: number): number {
  return n * 2
}
`
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Fix null check in deprecated helper"')

    try {
      git(tmpDir, 'merge', 'feature')
    } catch {
      // Expected
    }

    const content = readFileSync(join(tmpDir, 'helpers.ts'), 'utf8')
    const conflictedFiles: Array<IConflictedFile> = content.includes('<<<<<<<')
      ? [{ path: 'helpers.ts', content }]
      : []

    return {
      id: 'adversarial-delete-modify',
      description: this.description,
      kind: 'merge',
      repoPath: tmpDir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata: null,
      verifyCoherence: (resolutions: Map<string, string>): boolean => {
        const resolved = resolutions.get('helpers.ts') ?? ''
        // deprecatedHelper should NOT appear — deletion wins
        const hasDeprecated = /\bdeprecatedHelper\b/.test(resolved)
        // activeHelper and anotherHelper should still be present
        const hasActive = /\bactiveHelper\b/.test(resolved)
        const hasAnother = /\banotherHelper\b/.test(resolved)
        return !hasDeprecated && hasActive && hasAnother
      },
      verifyIntent: null,
      tags: ['adversarial'],
    }
  },
}

// ---------------------------------------------------------------------------
// adversarial-config
// ---------------------------------------------------------------------------

const adversarialConfig: IScenarioFactory = {
  id: 'adversarial-config',
  description:
    'Both branches change DB host in two config files; must be consistent',
  tags: ['adversarial'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    initRepo(tmpDir)
    mkdirSync(join(tmpDir, 'config'), { recursive: true })

    writeFileSync(
      join(tmpDir, 'config', 'database.json'),
      JSON.stringify(
        {
          host: 'db-legacy.internal',
          port: 5432,
          name: 'appdb',
          maxConnections: 20,
        },
        null,
        2
      ) + '\n'
    )

    writeFileSync(
      join(tmpDir, 'config', 'api.json'),
      JSON.stringify(
        {
          databaseUrl: 'postgresql://db-legacy.internal:5432/appdb',
          cacheHost: 'cache.internal',
          timeout: 30000,
        },
        null,
        2
      ) + '\n'
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Initial config with legacy DB host"')

    // Feature: change to primary production DB
    git(tmpDir, 'checkout', '-b', 'feature')

    writeFileSync(
      join(tmpDir, 'config', 'database.json'),
      JSON.stringify(
        {
          host: 'db-primary.prod.internal',
          port: 5432,
          name: 'appdb',
          maxConnections: 50,
        },
        null,
        2
      ) + '\n'
    )

    writeFileSync(
      join(tmpDir, 'config', 'api.json'),
      JSON.stringify(
        {
          databaseUrl: 'postgresql://db-primary.prod.internal:5432/appdb',
          cacheHost: 'cache.internal',
          timeout: 30000,
        },
        null,
        2
      ) + '\n'
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Migrate to primary production database host"')

    // Main: change to staging replica
    git(tmpDir, 'checkout', 'main')

    writeFileSync(
      join(tmpDir, 'config', 'database.json'),
      JSON.stringify(
        {
          host: 'db-replica.staging.internal',
          port: 5432,
          name: 'appdb',
          maxConnections: 10,
        },
        null,
        2
      ) + '\n'
    )

    writeFileSync(
      join(tmpDir, 'config', 'api.json'),
      JSON.stringify(
        {
          databaseUrl: 'postgresql://db-replica.staging.internal:5432/appdb',
          cacheHost: 'cache.internal',
          timeout: 60000,
        },
        null,
        2
      ) + '\n'
    )

    git(tmpDir, 'add', '-A')
    git(tmpDir, 'commit', '-m', '"Point to staging replica database"')

    try {
      git(tmpDir, 'merge', 'feature')
    } catch {
      // Expected
    }

    const conflictedFiles: Array<IConflictedFile> = []
    for (const path of ['config/database.json', 'config/api.json']) {
      const content = readFileSync(join(tmpDir, path), 'utf8')
      if (content.includes('<<<<<<<')) {
        conflictedFiles.push({ path, content })
      }
    }

    return {
      id: 'adversarial-config',
      description: this.description,
      kind: 'merge',
      repoPath: tmpDir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature',
      prMetadata: null,
      verifyCoherence: (resolutions: Map<string, string>): boolean => {
        const dbContent = resolutions.get('config/database.json') ?? ''
        const apiContent = resolutions.get('config/api.json') ?? ''

        // Extract host from database.json
        let dbHost: string | null = null
        try {
          const dbConfig = JSON.parse(dbContent)
          dbHost = dbConfig.host
        } catch {
          return false
        }

        // Extract host from api.json databaseUrl
        let apiHost: string | null = null
        try {
          const apiConfig = JSON.parse(apiContent)
          const urlMatch = (apiConfig.databaseUrl as string).match(
            /\/\/([^:]+):/
          )
          apiHost = urlMatch ? urlMatch[1] : null
        } catch {
          return false
        }

        // Both must reference the same host
        return dbHost !== null && apiHost !== null && dbHost === apiHost
      },
      verifyIntent: null,
      tags: ['adversarial'],
    }
  },
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const adversarialScenarios: ReadonlyArray<IScenarioFactory> = [
  adversarialRename,
  adversarialInterface,
  adversarialImport,
  adversarialPrIntent,
  adversarialDeleteModify,
  adversarialConfig,
]
