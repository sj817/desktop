import fs from 'fs'
import os from 'os'
import path from 'path'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const distRoot = path.join(projectRoot, 'dist')
const distArchitecture =
  process.env.TARGET_ARCH ??
  process.env.npm_config_arch ??
  (process.arch === 'arm64' ? 'arm64' : 'x64')
const distSuffix = `-${process.platform}-${distArchitecture}`
const distFolderName = fs
  .readdirSync(distRoot)
  .find(name => name.endsWith(distSuffix))

if (distFolderName === undefined) {
  throw new Error(`Unable to find packaged app in ${distRoot}`)
}

const distPath = path.join(distRoot, distFolderName)
const productName = distFolderName.slice(0, -distSuffix.length)
const appBinaryPath =
  process.platform === 'darwin'
    ? path.join(distPath, `${productName}.app`, 'Contents', 'MacOS', productName)
    : process.platform === 'win32'
      ? path.join(distPath, `${productName}.exe`)
      : path.join(distPath, productName)
const userDataDir = path.join(os.tmpdir(), 'github-desktop-wdio-user-data')

fs.rmSync(userDataDir, { recursive: true, force: true })
fs.mkdirSync(userDataDir, { recursive: true })

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [path.join(__dirname, '*.ts')],
  exclude: [path.join(__dirname, 'wdio.conf.ts')],

  maxInstances: 1,
  capabilities: [
    {
      browserName: 'electron',
      browserVersion: '40.1.0',
      'wdio:electronServiceOptions': {
        appBinaryPath,
        appArgs: [`--user-data-dir=${userDataDir}`],
      },
    },
  ],

  logLevel: 'warn',
  waitforTimeout: 10000,
  connectionRetryTimeout: 30000,
  connectionRetryCount: 1,

  services: ['electron'],
  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
}
