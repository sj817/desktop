import 'fake-indexeddb/auto'
import 'global-jsdom/register'
import { mock } from 'node:test'

// These constants are defined by Webpack at build time, but since tests aren't
// built with Webpack we need to make sure these exist at runtime.
const packageInfo = await import('../package.json')

Object.assign(globalThis, {
  __DEV__: false,
  __TEST__: true,
  __DEV_SECRETS__: false,
  __APP_NAME__: packageInfo.productName,
  __APP_VERSION__: packageInfo.version,
  __RELEASE_CHANNEL__: 'development',
  __UPDATES_URL__: '',
  __SHA__: 'test',
  __DARWIN__: process.platform === 'darwin',
  __WIN32__: process.platform === 'win32',
  __LINUX__: process.platform === 'linux',
  log: {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  },

  // The following types are part of the WebWorker support in Node.js and are a
  // common source of hangs in tests due to libraries creating them but not
  // properly cleaning them up. See for example
  // https://github.com/facebook/react/issues/20756, and
  // https://github.com/dexie/Dexie.js/pull/1577.
  //
  // We've upgraded Dexie already but react-dom is a bigger beast and we don't
  // need any of them to run our tests so we just delete them here. In fact,
  // this is exactly what the react-16-node-hanging-test-fix patch does, see
  // https://www.npmjs.com/package/react-16-node-hanging-test-fix?activeTab=code
  MessageChannel: undefined,
  MessagePort: undefined,
  BroadcastChannel: undefined,
})

Object.assign(globalThis, {
  Event: window.Event,
  CustomEvent: window.CustomEvent,
})

type DialogElement = HTMLElement & {
  open?: boolean
  showModal?: () => void
  close?: () => void
}

const dialogPrototype = HTMLElement.prototype as DialogElement

if (typeof dialogPrototype.showModal !== 'function') {
  dialogPrototype.showModal = function () {
    this.open = true
    this.setAttribute('open', '')
  }
}

if (typeof dialogPrototype.close !== 'function') {
  dialogPrototype.close = function () {
    this.open = false
    this.removeAttribute('open')
  }
}

if (globalThis.ResizeObserver === undefined) {
  class TestResizeObserver {
    public observe() {}
    public disconnect() {}
  }

  Object.assign(globalThis, { ResizeObserver: TestResizeObserver })
}

Object.defineProperty(HTMLFormElement.prototype, 'requestSubmit', {
  configurable: true,
  writable: true,
  value: function () {
    this.dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    )
  },
})

mock.module('electron', {
  namedExports: {
    shell: {},
    ipcRenderer: {
      on: mock.fn(() => {}),
      once: mock.fn(() => {}),
      send: mock.fn(() => {}),
      sendSync: mock.fn(() => {}),
      invoke: mock.fn(async () => undefined),
      removeListener: mock.fn(() => {}),
    },
  },
})
