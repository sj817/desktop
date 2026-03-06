import path from 'path'

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const electronBinaryPath = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  'electron'
)
const appPath = path.resolve(__dirname, '../../out')

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
        appBinaryPath: electronBinaryPath,
        appArgs: [appPath],
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
