/* eslint-disable no-sync */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { ensureSmokeTestRepository, smokeRepoPath } from './test-helpers'
import {
  createMockUpdateServer,
  type IMockUpdateServer,
} from './mock-update-server'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const appEntryPoint = path.join(projectRoot, 'out', 'main.js')
const userDataDir = path.join(os.tmpdir(), 'github-desktop-wdio-user-data')
const fakeHomeDir = path.join(os.tmpdir(), 'github-desktop-wdio-fake-home')

ensureSmokeTestRepository()

if (!fs.existsSync(appEntryPoint)) {
  throw new Error(`Unable to find built app entry point at ${appEntryPoint}`)
}

fs.rmSync(userDataDir, { recursive: true, force: true })
fs.mkdirSync(userDataDir, { recursive: true })

fs.rmSync(fakeHomeDir, { recursive: true, force: true })
fs.mkdirSync(fakeHomeDir, { recursive: true })

// Isolate git configuration so that e2e tests don't read or modify the
// developer's real ~/.gitconfig. The Electron process inherits these
// environment variables.
process.env.GIT_CONFIG_GLOBAL = path.join(fakeHomeDir, '.gitconfig')
process.env.GIT_CONFIG_SYSTEM = path.join(fakeHomeDir, '.gitconfig-system')
// Prevent git from reading the user's ~/.gitconfig via XDG paths
process.env.XDG_CONFIG_HOME = path.join(fakeHomeDir, '.config')
// Prevent SSH from using the user's real keys during git operations
process.env.SSH_AUTH_SOCK = ''
process.env.GIT_SSH_COMMAND = 'false'

let mockUpdateServer: IMockUpdateServer | null = null

export const config: WebdriverIO.Config = {
  runner: 'local',
  rootDir: projectRoot,
  specs: [path.join(__dirname, '*.ts')],
  exclude: [
    path.join(__dirname, 'wdio.conf.ts'),
    path.join(__dirname, 'test-helpers.ts'),
    path.join(__dirname, 'mock-update-server.ts'),
  ],

  maxInstances: 1,
  services: [
    [
      'electron',
      {
        // Set a very short bridge timeout so it fails quickly and
        // doesn't block test execution. We don't use Electron API
        // mocking so the bridge is not needed.
        cdpBridgeTimeout: 1,
      },
    ],
  ],
  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        appEntryPoint,
        appArgs: [
          `--user-data-dir=${userDataDir}`,
          `--cli-open=${smokeRepoPath}`,
        ],
      },
    } as WebdriverIO.Capabilities,
  ],

  logLevel: 'warn',
  waitforTimeout: 10000,
  connectionRetryTimeout: 30000,
  connectionRetryCount: 1,

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },

  async onPrepare() {
    mockUpdateServer = await createMockUpdateServer()
    console.log(`Mock update server listening at ${mockUpdateServer.url}`)
  },

  async onComplete() {
    if (mockUpdateServer !== null) {
      await mockUpdateServer.close()
      console.log('Mock update server stopped')
    }
  },
}
