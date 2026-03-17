/* eslint-disable no-sync */

/**
 * Shared Playwright fixtures for GitHub Desktop e2e tests.
 *
 * Provides:
 *  - `app`  — the ElectronApplication instance
 *  - `page` — the main BrowserWindow page
 *  - `mockServer` — the mock update server (with control helpers)
 *
 * All fixtures are scoped to the **worker** so the app launches once
 * and all tests in the file share the same session (one Electron
 * session runs all specs sequentially).
 */

import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import {
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { _electron as electron } from 'playwright'
import { ensureSmokeTestRepository, smokeRepoPath } from './test-helpers'
import {
  createMockUpdateServer,
  MOCK_CONTROL_URL,
  type IMockUpdateServer,
} from './mock-update-server'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const appEntryPoint = path.join(projectRoot, 'out', 'main.js')
const userDataDir = path.join(os.tmpdir(), 'github-desktop-pw-e2e')
const fakeHomeDir = path.join(os.tmpdir(), 'github-desktop-pw-fake-home')

// ── Helpers exposed to tests ────────────────────────────────────────

export function controlMockServer(action: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get(`${MOCK_CONTROL_URL}/${action}`, res => {
        let data = ''
        res.on('data', (chunk: string) => (data += chunk))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
  })
}

export async function getMockRequests(): Promise<
  ReadonlyArray<{ method: string; url: string }>
> {
  return JSON.parse(await controlMockServer('requests'))
}

export async function dismissMoveToApplicationsDialog(page: Page) {
  const btn = page.locator(
    'button:has-text("Not Now"), button:has-text("Not now")'
  )
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click()
    await btn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  }
}

// ── Fixtures ────────────────────────────────────────────────────────

type E2EFixtures = {
  app: ElectronApplication
  mainWindow: Page
  mockServer: IMockUpdateServer
}

export const test = base.extend<{}, E2EFixtures>({
  // Worker-scoped: one Electron app per test file.
  // Depends on mockServer so the update server is ready before launch.
  app: [
    async ({ mockServer }, use) => {
      // Setup directories
      ensureSmokeTestRepository()
      fs.rmSync(userDataDir, { recursive: true, force: true })
      fs.mkdirSync(userDataDir, { recursive: true })
      fs.rmSync(fakeHomeDir, { recursive: true, force: true })
      fs.mkdirSync(fakeHomeDir, { recursive: true })

      const app = await electron.launch({
        args: [
          appEntryPoint,
          `--user-data-dir=${userDataDir}`,
          `--cli-open=${smokeRepoPath}`,
        ],
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: path.join(fakeHomeDir, '.gitconfig'),
          GIT_CONFIG_SYSTEM: path.join(fakeHomeDir, '.gitconfig-system'),
          XDG_CONFIG_HOME: path.join(fakeHomeDir, '.config'),
          SSH_AUTH_SOCK: '',
          GIT_SSH_COMMAND: 'false',
        },
        recordVideo: {
          dir: path.join(projectRoot, 'playwright-videos'),
          size: { width: 1280, height: 800 },
        },
        timeout: 30000,
      })

      await use(app)

      await app.close().catch(() => {})
    },
    { scope: 'worker' },
  ],

  mainWindow: [
    async ({ app }, use) => {
      const page = await app.firstWindow()

      // Start tracing for this worker session
      await page.context().tracing.start({
        screenshots: true,
        snapshots: true,
      })

      await use(page)

      // Save trace on teardown
      const tracePath = path.join(
        projectRoot,
        'playwright-videos',
        `trace-${Date.now()}.zip`
      )
      await page
        .context()
        .tracing.stop({ path: tracePath })
        .catch(() => {})
    },
    { scope: 'worker' },
  ],

  mockServer: [
    async ({}, use) => {
      const server = await createMockUpdateServer()
      await use(server)
      await server.close()
    },
    { scope: 'worker' },
  ],
})

export { expect } from '@playwright/test'
