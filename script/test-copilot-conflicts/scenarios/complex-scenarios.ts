/**
 * Complex realistic conflict scenario.
 *
 * Simulates a real-world OAuth2 migration PR conflicting with a parallel
 * rate-limiting feature branch. 10 interdependent files with cross-file
 * coherence requirements, shared types, and PR metadata context.
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

function collectConflictedFiles(dir: string): ReadonlyArray<IConflictedFile> {
  const status = git(dir, 'status', '--porcelain')
  const files: Array<IConflictedFile> = []

  for (const line of status.split('\n')) {
    const match = line.match(/^(?:UU|AA|DD|AU|UA|DU|UD)\s+(.+)$/)
    if (match) {
      const filePath = match[1].trim()
      const content = readFileSync(join(dir, filePath), 'utf8')
      files.push({ path: filePath, content })
    }
  }

  return files
}

// ---------------------------------------------------------------------------
// complex-oauth-migration
//
// Scenario: A team is migrating from API key auth to OAuth2. Meanwhile,
// another developer added rate limiting that hooks into the auth layer.
// Both branches modify types, services, middleware, config, and handlers.
// Correct resolution requires understanding that OAuth2 should win for
// auth mechanism but rate limiting features should be preserved.
// ---------------------------------------------------------------------------

const complexOAuthMigration: IScenarioFactory = {
  id: 'complex-oauth-migration',
  description:
    'OAuth2 migration PR conflicts with rate-limiting feature across 10 interdependent files',
  tags: ['complex', 'adversarial'],

  async generate(tmpDir: string): Promise<IGeneratedScenario> {
    const dir = join(tmpDir, 'repo')
    mkdirSync(dir, { recursive: true })
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true })
    mkdirSync(join(dir, 'src', 'middleware'), { recursive: true })
    mkdirSync(join(dir, 'src', 'api'), { recursive: true })
    mkdirSync(join(dir, 'src', 'config'), { recursive: true })
    mkdirSync(join(dir, 'test'), { recursive: true })
    initRepo(dir)

    // ========== BASE STATE (main) ==========

    // 1. src/auth/types.ts — Auth type definitions
    writeFileSync(join(dir, 'src/auth/types.ts'), `export interface AuthCredentials {
  apiKey: string
  apiSecret: string
}

export interface AuthSession {
  userId: string
  permissions: string[]
  expiresAt: number
  credentials: AuthCredentials
}

export interface AuthConfig {
  provider: 'api-key'
  keyHeader: string
  secretHeader: string
  sessionTtlMs: number
}

export type AuthResult =
  | { success: true; session: AuthSession }
  | { success: false; error: string }
`)

    // 2. src/auth/validator.ts — Validates credentials
    writeFileSync(join(dir, 'src/auth/validator.ts'), `import { AuthCredentials, AuthResult, AuthConfig } from './types'

const VALID_KEY_PATTERN = /^ak_[a-zA-Z0-9]{32}$/

export class AuthValidator {
  constructor(private config: AuthConfig) {}

  async validate(credentials: AuthCredentials): Promise<AuthResult> {
    if (!credentials.apiKey || !credentials.apiSecret) {
      return { success: false, error: 'Missing credentials' }
    }

    if (!VALID_KEY_PATTERN.test(credentials.apiKey)) {
      return { success: false, error: 'Invalid API key format' }
    }

    const isValid = await this.verifyKeyPair(
      credentials.apiKey,
      credentials.apiSecret
    )

    if (!isValid) {
      return { success: false, error: 'Invalid credentials' }
    }

    return {
      success: true,
      session: {
        userId: this.extractUserId(credentials.apiKey),
        permissions: ['read', 'write'],
        expiresAt: Date.now() + this.config.sessionTtlMs,
        credentials,
      },
    }
  }

  private async verifyKeyPair(key: string, secret: string): Promise<boolean> {
    // In production, verify against key store
    return key.length > 0 && secret.length > 0
  }

  private extractUserId(key: string): string {
    return key.slice(3, 11)
  }
}
`)

    // 3. src/auth/session-store.ts — Session management
    writeFileSync(join(dir, 'src/auth/session-store.ts'), `import { AuthSession } from './types'

export class SessionStore {
  private sessions = new Map<string, AuthSession>()

  store(session: AuthSession): string {
    const sessionId = this.generateId()
    this.sessions.set(sessionId, session)
    return sessionId
  }

  get(sessionId: string): AuthSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId)
      return null
    }
    return session
  }

  revoke(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  getActiveCount(): number {
    return this.sessions.size
  }

  private generateId(): string {
    return 'sess_' + Math.random().toString(36).slice(2)
  }
}
`)

    // 4. src/middleware/auth-middleware.ts — Express middleware
    writeFileSync(join(dir, 'src/middleware/auth-middleware.ts'), `import { Request, Response, NextFunction } from 'express'
import { AuthValidator } from '../auth/validator'
import { SessionStore } from '../auth/session-store'
import { AuthConfig, AuthCredentials } from '../auth/types'

export function createAuthMiddleware(config: AuthConfig, sessionStore: SessionStore) {
  const validator = new AuthValidator(config)

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check for existing session
    const sessionId = req.headers['x-session-id'] as string
    if (sessionId) {
      const session = sessionStore.get(sessionId)
      if (session) {
        req.auth = session
        return next()
      }
    }

    // Extract credentials from headers
    const credentials: AuthCredentials = {
      apiKey: req.headers[config.keyHeader] as string,
      apiSecret: req.headers[config.secretHeader] as string,
    }

    const result = await validator.validate(credentials)

    if (!result.success) {
      return res.status(401).json({ error: result.error })
    }

    // Store session for future requests
    const newSessionId = sessionStore.store(result.session)
    res.setHeader('x-session-id', newSessionId)
    req.auth = result.session
    next()
  }
}
`)

    // 5. src/middleware/error-handler.ts — Error handling
    writeFileSync(join(dir, 'src/middleware/error-handler.ts'), `import { Request, Response, NextFunction } from 'express'

export interface AppError {
  statusCode: number
  message: string
  code: string
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  console.error(\`[\${new Date().toISOString()}] \${req.method} \${req.path} - \${statusCode}: \${message}\`)

  res.status(statusCode).json({
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
    },
  })
}
`)

    // 6. src/api/routes.ts — API routes
    writeFileSync(join(dir, 'src/api/routes.ts'), `import { Router, Request, Response } from 'express'
import { AuthSession } from '../auth/types'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthSession
    }
  }
}

export function createRouter(): Router {
  const router = Router()

  router.get('/me', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    res.json({
      userId: req.auth.userId,
      permissions: req.auth.permissions,
    })
  })

  router.get('/resources', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!req.auth.permissions.includes('read')) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    res.json({ resources: [] })
  })

  router.post('/resources', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!req.auth.permissions.includes('write')) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    res.status(201).json({ id: 'new-resource' })
  })

  return router
}
`)

    // 7. src/config/app-config.ts — Application config
    writeFileSync(join(dir, 'src/config/app-config.ts'), `import { AuthConfig } from '../auth/types'

export interface AppConfig {
  port: number
  auth: AuthConfig
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'json' | 'text'
  }
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    auth: {
      provider: 'api-key',
      keyHeader: 'x-api-key',
      secretHeader: 'x-api-secret',
      sessionTtlMs: 3600000, // 1 hour
    },
    logging: {
      level: (process.env.LOG_LEVEL as AppConfig['logging']['level']) || 'info',
      format: 'json',
    },
  }
}
`)

    // 8. src/api/server.ts — Server setup
    writeFileSync(join(dir, 'src/api/server.ts'), `import express from 'express'
import { loadConfig } from '../config/app-config'
import { createAuthMiddleware } from '../middleware/auth-middleware'
import { errorHandler } from '../middleware/error-handler'
import { SessionStore } from '../auth/session-store'
import { createRouter } from './routes'

export function createServer() {
  const config = loadConfig()
  const app = express()
  const sessionStore = new SessionStore()

  app.use(express.json())
  app.use(createAuthMiddleware(config.auth, sessionStore))
  app.use('/api', createRouter())
  app.use(errorHandler)

  return { app, config }
}

export function startServer() {
  const { app, config } = createServer()
  app.listen(config.port, () => {
    console.log(\`Server running on port \${config.port}\`)
    console.log(\`Auth provider: \${config.auth.provider}\`)
  })
}
`)

    // 9. test/auth.test.ts — Auth tests
    writeFileSync(join(dir, 'test/auth.test.ts'), `import { AuthValidator } from '../src/auth/validator'
import { AuthConfig } from '../src/auth/types'

const testConfig: AuthConfig = {
  provider: 'api-key',
  keyHeader: 'x-api-key',
  secretHeader: 'x-api-secret',
  sessionTtlMs: 3600000,
}

describe('AuthValidator', () => {
  const validator = new AuthValidator(testConfig)

  it('should reject missing credentials', async () => {
    const result = await validator.validate({ apiKey: '', apiSecret: '' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid key format', async () => {
    const result = await validator.validate({
      apiKey: 'invalid-key',
      apiSecret: 'secret123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Invalid API key format')
    }
  })

  it('should accept valid credentials', async () => {
    const result = await validator.validate({
      apiKey: 'ak_abcdefghijklmnopqrstuvwxyz123456',
      apiSecret: 'secret123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.session.userId).toBeDefined()
      expect(result.session.permissions).toContain('read')
    }
  })
})
`)

    // 10. src/auth/index.ts — Auth module barrel export
    writeFileSync(join(dir, 'src/auth/index.ts'), `export { AuthValidator } from './validator'
export { SessionStore } from './session-store'
export type {
  AuthCredentials,
  AuthSession,
  AuthConfig,
  AuthResult,
} from './types'
`)

    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'Initial auth system with API key authentication')

    // ========== FEATURE BRANCH: OAuth2 Migration ==========
    git(dir, 'checkout', '-b', 'feature/oauth2-migration')

    // 1. types.ts — Replace API key types with OAuth2
    writeFileSync(join(dir, 'src/auth/types.ts'), `export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface AuthSession {
  userId: string
  permissions: string[]
  expiresAt: number
  tokens: OAuthTokens
  scopes: string[]
}

export interface AuthConfig {
  provider: 'oauth2'
  clientId: string
  clientSecret: string
  tokenEndpoint: string
  authorizationEndpoint: string
  redirectUri: string
  scopes: string[]
  sessionTtlMs: number
}

export type AuthResult =
  | { success: true; session: AuthSession }
  | { success: false; error: string; errorCode?: string }
`)

    // 2. validator.ts — OAuth2 token validation
    writeFileSync(join(dir, 'src/auth/validator.ts'), `import { OAuthTokens, AuthResult, AuthConfig } from './types'

export class AuthValidator {
  constructor(private config: AuthConfig) {}

  async validate(tokens: OAuthTokens): Promise<AuthResult> {
    if (!tokens.accessToken) {
      return { success: false, error: 'Missing access token', errorCode: 'NO_TOKEN' }
    }

    if (tokens.tokenType !== 'Bearer') {
      return { success: false, error: 'Invalid token type', errorCode: 'INVALID_TYPE' }
    }

    const introspection = await this.introspectToken(tokens.accessToken)

    if (!introspection.active) {
      return { success: false, error: 'Token expired or revoked', errorCode: 'TOKEN_EXPIRED' }
    }

    return {
      success: true,
      session: {
        userId: introspection.sub,
        permissions: introspection.scope.split(' '),
        expiresAt: Date.now() + (tokens.expiresIn * 1000),
        tokens,
        scopes: introspection.scope.split(' '),
      },
    }
  }

  async refreshSession(refreshToken: string): Promise<AuthResult> {
    try {
      const response = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      })

      if (!response.ok) {
        return { success: false, error: 'Token refresh failed', errorCode: 'REFRESH_FAILED' }
      }

      const newTokens: OAuthTokens = await response.json()
      return this.validate(newTokens)
    } catch (err) {
      return { success: false, error: 'Token refresh network error', errorCode: 'NETWORK_ERROR' }
    }
  }

  private async introspectToken(token: string): Promise<{ active: boolean; sub: string; scope: string }> {
    // In production, call the introspection endpoint
    return { active: true, sub: 'user_' + token.slice(0, 8), scope: 'read write' }
  }
}
`)

    // 3. session-store.ts — Updated for OAuth tokens
    writeFileSync(join(dir, 'src/auth/session-store.ts'), `import { AuthSession } from './types'

export class SessionStore {
  private sessions = new Map<string, AuthSession>()

  store(session: AuthSession): string {
    const sessionId = this.generateId()
    this.sessions.set(sessionId, session)
    return sessionId
  }

  get(sessionId: string): AuthSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId)
      return null
    }
    return session
  }

  revoke(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  revokeAllForUser(userId: string): number {
    let count = 0
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id)
        count++
      }
    }
    return count
  }

  getActiveCount(): number {
    return this.sessions.size
  }

  private generateId(): string {
    return 'sess_' + Math.random().toString(36).slice(2)
  }
}
`)

    // 4. auth-middleware.ts — OAuth2 Bearer token middleware
    writeFileSync(join(dir, 'src/middleware/auth-middleware.ts'), `import { Request, Response, NextFunction } from 'express'
import { AuthValidator } from '../auth/validator'
import { SessionStore } from '../auth/session-store'
import { AuthConfig, OAuthTokens } from '../auth/types'

export function createAuthMiddleware(config: AuthConfig, sessionStore: SessionStore) {
  const validator = new AuthValidator(config)

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check for existing session
    const sessionId = req.headers['x-session-id'] as string
    if (sessionId) {
      const session = sessionStore.get(sessionId)
      if (session) {
        req.auth = session
        return next()
      }
    }

    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid Authorization header',
        errorCode: 'NO_AUTH_HEADER',
      })
    }

    const accessToken = authHeader.slice(7)
    const tokens: OAuthTokens = {
      accessToken,
      refreshToken: req.headers['x-refresh-token'] as string || '',
      expiresIn: 3600,
      tokenType: 'Bearer',
    }

    const result = await validator.validate(tokens)

    if (!result.success) {
      // Try refresh if we have a refresh token
      if (result.errorCode === 'TOKEN_EXPIRED' && tokens.refreshToken) {
        const refreshResult = await validator.refreshSession(tokens.refreshToken)
        if (refreshResult.success) {
          const newSessionId = sessionStore.store(refreshResult.session)
          res.setHeader('x-session-id', newSessionId)
          res.setHeader('x-new-access-token', refreshResult.session.tokens.accessToken)
          req.auth = refreshResult.session
          return next()
        }
      }
      return res.status(401).json({ error: result.error, errorCode: result.errorCode })
    }

    const newSessionId = sessionStore.store(result.session)
    res.setHeader('x-session-id', newSessionId)
    req.auth = result.session
    next()
  }
}
`)

    // 5. error-handler.ts — Add OAuth error codes
    writeFileSync(join(dir, 'src/middleware/error-handler.ts'), `import { Request, Response, NextFunction } from 'express'

export interface AppError {
  statusCode: number
  message: string
  code: string
  details?: Record<string, unknown>
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  console.error(\`[\${new Date().toISOString()}] \${req.method} \${req.path} - \${statusCode}: \${message}\`)

  res.status(statusCode).json({
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
      ...(err.details && { details: err.details }),
    },
  })
}

export function createAuthError(message: string, code: string): AppError {
  return { statusCode: 401, message, code }
}
`)

    // 6. routes.ts — Updated for OAuth scopes
    writeFileSync(join(dir, 'src/api/routes.ts'), `import { Router, Request, Response } from 'express'
import { AuthSession } from '../auth/types'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthSession
    }
  }
}

export function createRouter(): Router {
  const router = Router()

  router.get('/me', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    res.json({
      userId: req.auth.userId,
      permissions: req.auth.permissions,
      scopes: req.auth.scopes,
      tokenExpiresAt: req.auth.expiresAt,
    })
  })

  router.get('/resources', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!req.auth.scopes.includes('read')) {
      return res.status(403).json({ error: 'Insufficient scopes', required: ['read'] })
    }
    res.json({ resources: [] })
  })

  router.post('/resources', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!req.auth.scopes.includes('write')) {
      return res.status(403).json({ error: 'Insufficient scopes', required: ['write'] })
    }
    res.status(201).json({ id: 'new-resource' })
  })

  return router
}
`)

    // 7. app-config.ts — OAuth2 config
    writeFileSync(join(dir, 'src/config/app-config.ts'), `import { AuthConfig } from '../auth/types'

export interface AppConfig {
  port: number
  auth: AuthConfig
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'json' | 'text'
  }
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    auth: {
      provider: 'oauth2',
      clientId: process.env.OAUTH_CLIENT_ID || '',
      clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
      tokenEndpoint: process.env.OAUTH_TOKEN_URL || 'https://auth.example.com/oauth/token',
      authorizationEndpoint: process.env.OAUTH_AUTH_URL || 'https://auth.example.com/oauth/authorize',
      redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback',
      scopes: ['read', 'write', 'admin'],
      sessionTtlMs: 3600000,
    },
    logging: {
      level: (process.env.LOG_LEVEL as AppConfig['logging']['level']) || 'info',
      format: 'json',
    },
  }
}
`)

    // 8. server.ts — Updated startup message
    writeFileSync(join(dir, 'src/api/server.ts'), `import express from 'express'
import { loadConfig } from '../config/app-config'
import { createAuthMiddleware } from '../middleware/auth-middleware'
import { errorHandler } from '../middleware/error-handler'
import { SessionStore } from '../auth/session-store'
import { createRouter } from './routes'

export function createServer() {
  const config = loadConfig()
  const app = express()
  const sessionStore = new SessionStore()

  app.use(express.json())
  app.use(createAuthMiddleware(config.auth, sessionStore))
  app.use('/api', createRouter())
  app.use(errorHandler)

  return { app, config, sessionStore }
}

export function startServer() {
  const { app, config } = createServer()
  app.listen(config.port, () => {
    console.log(\`Server running on port \${config.port}\`)
    console.log(\`Auth: OAuth2 via \${config.auth.tokenEndpoint}\`)
  })
}
`)

    // 9. test/auth.test.ts — OAuth2 tests
    writeFileSync(join(dir, 'test/auth.test.ts'), `import { AuthValidator } from '../src/auth/validator'
import { AuthConfig } from '../src/auth/types'

const testConfig: AuthConfig = {
  provider: 'oauth2',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  tokenEndpoint: 'https://auth.example.com/oauth/token',
  authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['read', 'write'],
  sessionTtlMs: 3600000,
}

describe('AuthValidator', () => {
  const validator = new AuthValidator(testConfig)

  it('should reject missing access token', async () => {
    const result = await validator.validate({
      accessToken: '',
      refreshToken: '',
      expiresIn: 3600,
      tokenType: 'Bearer',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('NO_TOKEN')
    }
  })

  it('should reject invalid token type', async () => {
    const result = await validator.validate({
      accessToken: 'some-token',
      refreshToken: '',
      expiresIn: 3600,
      tokenType: 'Basic' as any,
    })
    expect(result.success).toBe(false)
  })

  it('should accept valid Bearer token', async () => {
    const result = await validator.validate({
      accessToken: 'valid-access-token-12345',
      refreshToken: 'refresh-token-xyz',
      expiresIn: 3600,
      tokenType: 'Bearer',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.session.userId).toBeDefined()
      expect(result.session.scopes).toContain('read')
      expect(result.session.tokens.accessToken).toBe('valid-access-token-12345')
    }
  })

  it('should refresh expired tokens', async () => {
    const result = await validator.refreshSession('valid-refresh-token')
    expect(result.success).toBe(true)
  })
})
`)

    // 10. src/auth/index.ts — Updated exports
    writeFileSync(join(dir, 'src/auth/index.ts'), `export { AuthValidator } from './validator'
export { SessionStore } from './session-store'
export type {
  OAuthTokens,
  AuthSession,
  AuthConfig,
  AuthResult,
} from './types'
`)

    // Add PR metadata
    writeFileSync(join(dir, '.pr-metadata.json'), JSON.stringify({
      title: 'Migrate authentication from API keys to OAuth2',
      body: `## Summary\n\nThis PR replaces the legacy API key authentication system with OAuth2 Bearer token flow.\n\n### Changes\n- Replace \`AuthCredentials\` (apiKey/apiSecret) with \`OAuthTokens\` (accessToken/refreshToken)\n- Add token introspection and refresh flow\n- Update middleware to extract Bearer tokens from Authorization header\n- Add automatic token refresh on expiry\n- Update all config to use OAuth2 provider settings\n\n### Migration Notes\n- The old \`x-api-key\` and \`x-api-secret\` headers are no longer supported\n- Clients must use \`Authorization: Bearer <token>\` header\n- Refresh tokens should be sent via \`x-refresh-token\` header`,
    }, null, 2))

    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'Migrate from API key auth to OAuth2 Bearer token flow\n\nReplaces legacy apiKey/apiSecret with OAuth2 access/refresh tokens.\nAdds token introspection, automatic refresh, and scope-based permissions.')

    // ========== MAIN BRANCH: Rate Limiting Feature ==========
    git(dir, 'checkout', 'main')

    // 1. types.ts — Add rate limit tracking to session
    writeFileSync(join(dir, 'src/auth/types.ts'), `export interface AuthCredentials {
  apiKey: string
  apiSecret: string
}

export interface RateLimitInfo {
  requestCount: number
  windowStart: number
  tier: 'free' | 'pro' | 'enterprise'
}

export interface AuthSession {
  userId: string
  permissions: string[]
  expiresAt: number
  credentials: AuthCredentials
  rateLimit: RateLimitInfo
}

export interface AuthConfig {
  provider: 'api-key'
  keyHeader: string
  secretHeader: string
  sessionTtlMs: number
  rateLimits: {
    free: number
    pro: number
    enterprise: number
    windowMs: number
  }
}

export type AuthResult =
  | { success: true; session: AuthSession }
  | { success: false; error: string }
`)

    // 2. validator.ts — Add rate limit tier detection
    writeFileSync(join(dir, 'src/auth/validator.ts'), `import { AuthCredentials, AuthResult, AuthConfig, RateLimitInfo } from './types'

const VALID_KEY_PATTERN = /^ak_[a-zA-Z0-9]{32}$/

export class AuthValidator {
  constructor(private config: AuthConfig) {}

  async validate(credentials: AuthCredentials): Promise<AuthResult> {
    if (!credentials.apiKey || !credentials.apiSecret) {
      return { success: false, error: 'Missing credentials' }
    }

    if (!VALID_KEY_PATTERN.test(credentials.apiKey)) {
      return { success: false, error: 'Invalid API key format' }
    }

    const isValid = await this.verifyKeyPair(
      credentials.apiKey,
      credentials.apiSecret
    )

    if (!isValid) {
      return { success: false, error: 'Invalid credentials' }
    }

    const tier = this.detectTier(credentials.apiKey)
    const rateLimit: RateLimitInfo = {
      requestCount: 0,
      windowStart: Date.now(),
      tier,
    }

    return {
      success: true,
      session: {
        userId: this.extractUserId(credentials.apiKey),
        permissions: ['read', 'write'],
        expiresAt: Date.now() + this.config.sessionTtlMs,
        credentials,
        rateLimit,
      },
    }
  }

  private detectTier(apiKey: string): RateLimitInfo['tier'] {
    if (apiKey.startsWith('ak_ent')) return 'enterprise'
    if (apiKey.startsWith('ak_pro')) return 'pro'
    return 'free'
  }

  private async verifyKeyPair(key: string, secret: string): Promise<boolean> {
    return key.length > 0 && secret.length > 0
  }

  private extractUserId(key: string): string {
    return key.slice(3, 11)
  }
}
`)

    // 3. session-store.ts — Add rate limit checking
    writeFileSync(join(dir, 'src/auth/session-store.ts'), `import { AuthSession, RateLimitInfo } from './types'

export class SessionStore {
  private sessions = new Map<string, AuthSession>()

  store(session: AuthSession): string {
    const sessionId = this.generateId()
    this.sessions.set(sessionId, session)
    return sessionId
  }

  get(sessionId: string): AuthSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId)
      return null
    }
    return session
  }

  revoke(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  incrementRequestCount(sessionId: string): RateLimitInfo | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    session.rateLimit.requestCount++
    return session.rateLimit
  }

  resetRateLimitWindow(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.rateLimit.requestCount = 0
      session.rateLimit.windowStart = Date.now()
    }
  }

  getActiveCount(): number {
    return this.sessions.size
  }

  private generateId(): string {
    return 'sess_' + Math.random().toString(36).slice(2)
  }
}
`)

    // 4. auth-middleware.ts — Add rate limit enforcement
    writeFileSync(join(dir, 'src/middleware/auth-middleware.ts'), `import { Request, Response, NextFunction } from 'express'
import { AuthValidator } from '../auth/validator'
import { SessionStore } from '../auth/session-store'
import { AuthConfig, AuthCredentials } from '../auth/types'

export function createAuthMiddleware(config: AuthConfig, sessionStore: SessionStore) {
  const validator = new AuthValidator(config)

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check for existing session
    const sessionId = req.headers['x-session-id'] as string
    if (sessionId) {
      const session = sessionStore.get(sessionId)
      if (session) {
        // Check rate limit
        const rateLimit = sessionStore.incrementRequestCount(sessionId)
        if (rateLimit) {
          const limit = config.rateLimits[rateLimit.tier]
          const windowElapsed = Date.now() - rateLimit.windowStart

          if (windowElapsed > config.rateLimits.windowMs) {
            sessionStore.resetRateLimitWindow(sessionId)
          } else if (rateLimit.requestCount > limit) {
            const retryAfter = Math.ceil((config.rateLimits.windowMs - windowElapsed) / 1000)
            res.setHeader('Retry-After', retryAfter.toString())
            res.setHeader('X-RateLimit-Limit', limit.toString())
            res.setHeader('X-RateLimit-Remaining', '0')
            return res.status(429).json({
              error: 'Rate limit exceeded',
              retryAfterSeconds: retryAfter,
              tier: rateLimit.tier,
            })
          }

          res.setHeader('X-RateLimit-Limit', limit.toString())
          res.setHeader('X-RateLimit-Remaining', (limit - rateLimit.requestCount).toString())
        }

        req.auth = session
        return next()
      }
    }

    // Extract credentials from headers
    const credentials: AuthCredentials = {
      apiKey: req.headers[config.keyHeader] as string,
      apiSecret: req.headers[config.secretHeader] as string,
    }

    const result = await validator.validate(credentials)

    if (!result.success) {
      return res.status(401).json({ error: result.error })
    }

    // Store session for future requests
    const newSessionId = sessionStore.store(result.session)
    res.setHeader('x-session-id', newSessionId)
    res.setHeader('X-RateLimit-Limit', config.rateLimits[result.session.rateLimit.tier].toString())
    res.setHeader('X-RateLimit-Remaining', config.rateLimits[result.session.rateLimit.tier].toString())
    req.auth = result.session
    next()
  }
}
`)

    // 5. error-handler.ts — Add rate limit error type
    writeFileSync(join(dir, 'src/middleware/error-handler.ts'), `import { Request, Response, NextFunction } from 'express'

export interface AppError {
  statusCode: number
  message: string
  code: string
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  console.error(\`[\${new Date().toISOString()}] \${req.method} \${req.path} - \${statusCode}: \${message}\`)

  res.status(statusCode).json({
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
    },
  })
}

export function createRateLimitError(tier: string, retryAfter: number): AppError {
  return {
    statusCode: 429,
    message: \`Rate limit exceeded for \${tier} tier. Retry after \${retryAfter}s\`,
    code: 'RATE_LIMIT_EXCEEDED',
  }
}
`)

    // 6. routes.ts — Add rate limit info to responses
    writeFileSync(join(dir, 'src/api/routes.ts'), `import { Router, Request, Response } from 'express'
import { AuthSession } from '../auth/types'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthSession
    }
  }
}

export function createRouter(): Router {
  const router = Router()

  router.get('/me', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    res.json({
      userId: req.auth.userId,
      permissions: req.auth.permissions,
      rateLimitTier: req.auth.rateLimit.tier,
      requestsUsed: req.auth.rateLimit.requestCount,
    })
  })

  router.get('/resources', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!req.auth.permissions.includes('read')) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    res.json({ resources: [], rateLimitTier: req.auth.rateLimit.tier })
  })

  router.post('/resources', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!req.auth.permissions.includes('write')) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    res.status(201).json({ id: 'new-resource', rateLimitTier: req.auth.rateLimit.tier })
  })

  return router
}
`)

    // 7. app-config.ts — Add rate limit config
    writeFileSync(join(dir, 'src/config/app-config.ts'), `import { AuthConfig } from '../auth/types'

export interface AppConfig {
  port: number
  auth: AuthConfig
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'json' | 'text'
  }
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    auth: {
      provider: 'api-key',
      keyHeader: 'x-api-key',
      secretHeader: 'x-api-secret',
      sessionTtlMs: 3600000,
      rateLimits: {
        free: 100,
        pro: 1000,
        enterprise: 10000,
        windowMs: 60000, // 1 minute window
      },
    },
    logging: {
      level: (process.env.LOG_LEVEL as AppConfig['logging']['level']) || 'info',
      format: 'json',
    },
  }
}
`)

    // 8. server.ts — Log rate limit config
    writeFileSync(join(dir, 'src/api/server.ts'), `import express from 'express'
import { loadConfig } from '../config/app-config'
import { createAuthMiddleware } from '../middleware/auth-middleware'
import { errorHandler } from '../middleware/error-handler'
import { SessionStore } from '../auth/session-store'
import { createRouter } from './routes'

export function createServer() {
  const config = loadConfig()
  const app = express()
  const sessionStore = new SessionStore()

  app.use(express.json())
  app.use(createAuthMiddleware(config.auth, sessionStore))
  app.use('/api', createRouter())
  app.use(errorHandler)

  return { app, config, sessionStore }
}

export function startServer() {
  const { app, config } = createServer()
  app.listen(config.port, () => {
    console.log(\`Server running on port \${config.port}\`)
    console.log(\`Auth provider: \${config.auth.provider}\`)
    console.log(\`Rate limits: free=\${config.auth.rateLimits.free}, pro=\${config.auth.rateLimits.pro}, enterprise=\${config.auth.rateLimits.enterprise}\`)
  })
}
`)

    // 9. test/auth.test.ts — Add rate limit tests
    writeFileSync(join(dir, 'test/auth.test.ts'), `import { AuthValidator } from '../src/auth/validator'
import { SessionStore } from '../src/auth/session-store'
import { AuthConfig } from '../src/auth/types'

const testConfig: AuthConfig = {
  provider: 'api-key',
  keyHeader: 'x-api-key',
  secretHeader: 'x-api-secret',
  sessionTtlMs: 3600000,
  rateLimits: {
    free: 100,
    pro: 1000,
    enterprise: 10000,
    windowMs: 60000,
  },
}

describe('AuthValidator', () => {
  const validator = new AuthValidator(testConfig)

  it('should reject missing credentials', async () => {
    const result = await validator.validate({ apiKey: '', apiSecret: '' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid key format', async () => {
    const result = await validator.validate({
      apiKey: 'invalid-key',
      apiSecret: 'secret123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Invalid API key format')
    }
  })

  it('should accept valid credentials and assign rate limit tier', async () => {
    const result = await validator.validate({
      apiKey: 'ak_abcdefghijklmnopqrstuvwxyz123456',
      apiSecret: 'secret123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.session.userId).toBeDefined()
      expect(result.session.rateLimit.tier).toBe('free')
      expect(result.session.rateLimit.requestCount).toBe(0)
    }
  })

  it('should detect enterprise tier from key prefix', async () => {
    const result = await validator.validate({
      apiKey: 'ak_enterprise_key_padded_to32chars!',
      apiSecret: 'secret123',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.session.rateLimit.tier).toBe('enterprise')
    }
  })
})

describe('SessionStore rate limiting', () => {
  it('should track request counts', () => {
    const store = new SessionStore()
    const session = {
      userId: 'user1',
      permissions: ['read'],
      expiresAt: Date.now() + 3600000,
      credentials: { apiKey: 'ak_test', apiSecret: 'secret' },
      rateLimit: { requestCount: 0, windowStart: Date.now(), tier: 'free' as const },
    }

    const sessionId = store.store(session)
    const info = store.incrementRequestCount(sessionId)
    expect(info?.requestCount).toBe(1)

    store.incrementRequestCount(sessionId)
    const info2 = store.incrementRequestCount(sessionId)
    expect(info2?.requestCount).toBe(3)
  })
})
`)

    // 10. src/auth/index.ts — Export rate limit type
    writeFileSync(join(dir, 'src/auth/index.ts'), `export { AuthValidator } from './validator'
export { SessionStore } from './session-store'
export type {
  AuthCredentials,
  AuthSession,
  AuthConfig,
  AuthResult,
  RateLimitInfo,
} from './types'
`)

    git(dir, 'add', '.')
    git(dir, 'commit', '-m', 'Add rate limiting with tiered quotas (free/pro/enterprise)\n\nAdds per-session rate limiting that tracks request counts within\ntime windows. Tiers are detected from API key prefixes.')

    // ========== MERGE: feature into main ==========
    try {
      git(dir, 'merge', 'feature/oauth2-migration', '--no-commit')
    } catch {
      // Expected to fail with conflicts
    }

    const conflictedFiles = collectConflictedFiles(dir)

    return {
      id: 'complex-oauth-migration',
      description:
        'OAuth2 migration PR conflicts with rate-limiting feature across 10 interdependent files',
      kind: 'merge',
      repoPath: dir,
      conflictedFiles,
      fileCount: conflictedFiles.length,
      ourBranch: 'main',
      theirBranch: 'feature/oauth2-migration',
      prMetadata: {
        title: 'Migrate authentication from API keys to OAuth2',
        body: 'This PR replaces the legacy API key authentication system with OAuth2 Bearer token flow. The old x-api-key and x-api-secret headers are no longer supported. Clients must use Authorization: Bearer <token> header. Rate limiting should still be preserved but adapted to work with the new OAuth2 session model.',
      },
      verifyCoherence: (resolutions: Map<string, string>) => {
        // Check that OAuth2 types are used consistently across resolved files
        const types = resolutions.get('src/auth/types.ts') || ''
        const validator = resolutions.get('src/auth/validator.ts') || ''
        const config = resolutions.get('src/config/app-config.ts') || ''

        // types.ts should have both OAuth tokens AND rate limiting
        const hasOAuthTokens = types.includes('accessToken') && types.includes('refreshToken')
        const hasRateLimit = types.includes('rateLimit') || types.includes('RateLimit')
        // Validator should reference OAuth concepts
        const validatorUsesOAuth = validator.includes('accessToken') || validator.includes('OAuthTokens') || validator.includes('introspect')
        // Config should reference OAuth2
        const configUsesOAuth = config.includes('oauth2') || config.includes('clientId') || config.includes('tokenEndpoint')

        return hasOAuthTokens && hasRateLimit && validatorUsesOAuth && configUsesOAuth
      },
      verifyIntent: (resolutions: Map<string, string>) => {
        // PR intent: OAuth2 should replace API keys
        const types = resolutions.get('src/auth/types.ts') || ''
        // Should NOT have apiKey/apiSecret as primary auth
        const removedApiKey = !types.includes('apiKey: string') || types.includes('accessToken')
        return removedApiKey
      },
      tags: ['complex', 'adversarial'],
    }
  },
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const complexScenarios: ReadonlyArray<IScenarioFactory> = [
  complexOAuthMigration,
]
