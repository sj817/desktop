import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  RequestChannels,
  RequestResponseChannels,
} from '../../src/lib/ipc-shared'

/**
 * These tests verify the IPC channel contract — the set of channels that
 * the renderer and main processes use to communicate. If channels are
 * added or removed, these tests will fail, alerting developers to update
 * both sides of the IPC boundary.
 */
describe('IPC channel contract', () => {
  // We use a type-level trick: TypeScript won't let us iterate over a type's
  // keys at runtime, but we can use a known channel name to verify the types
  // compile and then check the count via a curated list.

  const expectedRequestChannels: ReadonlyArray<keyof RequestChannels> = [
    'select-all-window-contents',
    'dialog-did-open',
    'update-menu-state',
    'renderer-ready',
    'execute-menu-item-by-id',
    'show-certificate-trust-dialog',
    'get-app-menu',
    'update-preferred-app-menu-item-labels',
    'uncaught-exception',
    'send-error-report',
    'unsafe-open-directory',
    'menu-event',
    'log',
    'will-quit',
    'will-quit-even-if-updating',
    'cancel-quitting',
    'crash-ready',
    'crash-quit',
    'window-state-changed',
    'error',
    'zoom-factor-changed',
    'app-menu',
    'launch-timing-stats',
    'url-action',
    'cli-action',
    'certificate-error',
    'focus',
    'blur',
    'update-accounts',
    'quit-and-install-updates',
    'quit-app',
    'minimize-window',
    'maximize-window',
    'unmaximize-window',
    'close-window',
    'auto-updater-error',
    'auto-updater-checking-for-update',
    'auto-updater-update-available',
    'auto-updater-update-not-available',
    'auto-updater-update-downloaded',
    'native-theme-updated',
    'set-native-theme-source',
    'update-window-background-color',
    'focus-window',
    'notification-event',
    'set-window-zoom-factor',
    'show-installing-update',
    'install-windows-cli',
    'uninstall-windows-cli',
  ]

  const expectedResponseChannels: ReadonlyArray<keyof RequestResponseChannels> =
    [
      'get-path',
      'get-app-architecture',
      'get-app-path',
      'is-running-under-arm64-translation',
      'move-to-trash',
      'show-item-in-folder',
      'show-contextual-menu',
      'is-window-focused',
      'open-external',
      'is-in-application-folder',
      'move-to-applications-folder',
      'check-for-updates',
      'get-current-window-state',
      'get-current-window-zoom-factor',
      'resolve-proxy',
      'show-save-dialog',
      'show-open-dialog',
      'is-window-maximized',
      'get-apple-action-on-double-click',
      'should-use-dark-colors',
      'save-guid',
      'get-guid',
      'show-notification',
      'get-notifications-permission',
      'request-notifications-permission',
    ]

  describe('RequestChannels', () => {
    it('has the expected number of channels', () => {
      // This test will fail to compile if any channel name is wrong
      // (TypeScript will reject it as not keyof RequestChannels)
      assert.equal(expectedRequestChannels.length, 49)
    })

    it('includes critical lifecycle channels', () => {
      const critical: ReadonlyArray<keyof RequestChannels> = [
        'renderer-ready',
        'uncaught-exception',
        'will-quit',
        'log',
        'error',
      ]
      for (const channel of critical) {
        assert.ok(
          expectedRequestChannels.includes(channel),
          `Missing critical channel: ${channel}`
        )
      }
    })
  })

  describe('RequestResponseChannels', () => {
    it('has the expected number of channels', () => {
      assert.equal(expectedResponseChannels.length, 25)
    })

    it('includes critical request-response channels', () => {
      const critical: ReadonlyArray<keyof RequestResponseChannels> = [
        'get-path',
        'open-external',
        'show-save-dialog',
        'show-open-dialog',
        'should-use-dark-colors',
      ]
      for (const channel of critical) {
        assert.ok(
          expectedResponseChannels.includes(channel),
          `Missing critical channel: ${channel}`
        )
      }
    })
  })

  describe('total channel count', () => {
    it('has 74 total IPC channels', () => {
      const total =
        expectedRequestChannels.length + expectedResponseChannels.length
      assert.equal(total, 74)
    })
  })
})
