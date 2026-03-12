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

ensureSmokeTestRepository()

if (!fs.existsSync(appEntryPoint)) {
  throw new Error(`Unable to find built app entry point at ${appEntryPoint}`)
}

fs.rmSync(userDataDir, { recursive: true, force: true })
fs.mkdirSync(userDataDir, { recursive: true })

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
  services: [['electron', { cdpBridgeTimeout: 60000 }]],
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
  connectionRetryTimeout: 120000,
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
