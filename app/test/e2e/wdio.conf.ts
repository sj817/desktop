import fs from 'fs'
import os from 'os'
import path from 'path'

import { ensureSmokeTestRepository, smokeRepoPath } from './test-helpers'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const appEntryPoint = path.join(projectRoot, 'out', 'main.js')
const appBinaryPath =
  process.platform === 'darwin'
    ? path.join(
        projectRoot,
        'node_modules',
        'electron',
        'dist',
        'Electron.app',
        'Contents',
        'MacOS',
        'Electron'
      )
    : process.platform === 'win32'
    ? path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron')
const userDataDir = path.join(os.tmpdir(), 'github-desktop-wdio-user-data')

ensureSmokeTestRepository()

if (!fs.existsSync(appEntryPoint)) {
  throw new Error(`Unable to find built app entry point at ${appEntryPoint}`)
}

if (!fs.existsSync(appBinaryPath)) {
  throw new Error(`Unable to find Electron binary at ${appBinaryPath}`)
}

fs.rmSync(userDataDir, { recursive: true, force: true })
fs.mkdirSync(userDataDir, { recursive: true })

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [path.join(__dirname, '*.ts')],
  exclude: [
    path.join(__dirname, 'wdio.conf.ts'),
    path.join(__dirname, 'test-helpers.ts'),
  ],

  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      browserName: 'chrome',
      browserVersion: '144.0.7559.96',
      'goog:chromeOptions': {
        binary: appBinaryPath,
        windowTypes: ['app', 'webview'],
        args: [
          `--app=${appEntryPoint}`,
          `--user-data-dir=${userDataDir}`,
          `--cli-open=${smokeRepoPath}`,
        ],
      },
      'wdio:enforceWebDriverClassic': true,
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
    timeout: 30000,
  },
}
