/// <reference types="@wdio/globals/types" />

import http from 'http'
import { describe, it } from 'mocha'

import {
  getSmokeRepoCurrentBranch,
  getSmokeRepoHeadMessage,
  getSmokeRepoStatus,
  resetDesktopWindowHandle,
  smokeRepoFileContents,
  smokeRepoFileName,
  smokeRepoPath,
  switchToDesktopWindow,
} from './test-helpers'
import { MOCK_CONTROL_URL } from './mock-update-server'

async function dismissMoveToApplicationsDialog() {
  const notNowButton = await $(
    '//button[normalize-space()="Not Now" or normalize-space()="Not now"]'
  )

  if (await notNowButton.isDisplayed().catch(() => false)) {
    await notNowButton.click()
    await browser.waitUntil(
      async () => !(await notNowButton.isDisplayed().catch(() => false)),
      {
        timeout: 15000,
        timeoutMsg: 'Move-to-Applications dialog did not dismiss',
      }
    )
  }
}

/**
 * E2E Smoke Test: App Launch
 *
 * Verifies that GitHub Desktop launches and renders its initial UI.
 * This is the most basic smoke test — if this fails, the app is fundamentally broken.
 */
describe('GitHub Desktop - App Launch', () => {
  it('should launch, add a local repository, render a diff, commit a change, and switch branches cleanly', async () => {
    resetDesktopWindowHandle()
    await switchToDesktopWindow()

    const title = await browser.getTitle()
    expect(typeof title).toBe('string')

    // Wait for the React app to mount and render content
    await browser.waitUntil(
      async () => {
        const container = await $('#desktop-app-container')
        const html = await container.getHTML()
        return html.length > 100
      },
      {
        timeout: 30000,
        timeoutMsg: 'App did not render content within 30s',
      }
    )

    const skipWelcomeButton = await $('a.skip-button')
    await skipWelcomeButton.waitForDisplayed({ timeout: 30000 })
    await browser.execute(element => element.click(), skipWelcomeButton)

    const configureGit = await $('#configure-git')
    await configureGit.waitForDisplayed({ timeout: 15000 })

    const nameInput = await $('input[placeholder="Your Name"]')
    if ((await nameInput.getValue()) === '') {
      await nameInput.setValue('GitHub Desktop E2E')
    }

    const emailInput = await $('input[placeholder="your-email@example.com"]')
    if ((await emailInput.getValue()) === '') {
      await emailInput.setValue('desktop-e2e@example.com')
    }

    const finishButton = await $('//button[normalize-space()="Finish"]')
    await finishButton.click()

    await browser.waitUntil(async () => !(await $('#welcome').isExisting()), {
      timeout: 15000,
      timeoutMsg: 'Welcome flow did not close',
    })

    await dismissMoveToApplicationsDialog()

    const repoFileSelector = `//*[contains(normalize-space(), "${smokeRepoFileName}")]`
    const repoFile = await $(repoFileSelector)
    const noRepositoriesAddButton = await $(
      '//*[contains(normalize-space(), "Add an Existing Repository from your Local Drive") or contains(normalize-space(), "Add an Existing Repository from your local drive")]'
    )

    await browser.waitUntil(
      async () =>
        (await repoFile.isDisplayed().catch(() => false)) ||
        (await noRepositoriesAddButton.isDisplayed().catch(() => false)),
      {
        timeout: 15000,
        timeoutMsg:
          'Neither the repository view nor the empty-state add button appeared',
      }
    )

    if (!(await repoFile.isDisplayed().catch(() => false))) {
      await noRepositoriesAddButton.click()

      const pathInput = await $('input[placeholder="repository path"]')
      await pathInput.waitForDisplayed({ timeout: 15000 })

      if ((await pathInput.getValue()) !== smokeRepoPath) {
        await pathInput.setValue(smokeRepoPath)
      }

      const addRepositoryButton = await $(
        '//button[normalize-space()="Add Repository" or normalize-space()="Add repository"]'
      )

      await addRepositoryButton.waitForDisplayed({ timeout: 15000 })
      await addRepositoryButton.click()
    }

    await repoFile.waitForDisplayed({ timeout: 15000 })
    await expect(repoFile).toBeDisplayed()
    await browser.execute(element => element.click(), repoFile)

    const diffContainer = await $('.diff-container')
    await diffContainer.waitForDisplayed({ timeout: 15000 })
    await browser.waitUntil(
      async () =>
        (await diffContainer.getText()).includes(smokeRepoFileContents),
      {
        timeout: 15000,
        timeoutMsg:
          'Diff contents did not render for the smoke repository file',
      }
    )

    const commitForm = await $('//*[@aria-label="Create commit"]')
    await commitForm.waitForDisplayed({ timeout: 15000 })

    const commitButton = await commitForm.$('.commit-button')
    await browser.waitUntil(async () => await commitButton.isEnabled(), {
      timeout: 15000,
      timeoutMsg: 'Commit button did not become enabled',
    })

    await dismissMoveToApplicationsDialog()
    await commitButton.click()

    await browser.waitUntil(
      async () => getSmokeRepoHeadMessage() === 'Create smoke-change.txt',
      {
        timeout: 15000,
        timeoutMsg: 'Commit was not created in the smoke repository',
      }
    )

    await browser.waitUntil(async () => getSmokeRepoStatus() === '', {
      timeout: 15000,
      timeoutMsg: 'Smoke repository did not become clean after commit',
    })

    const initialBranch = getSmokeRepoCurrentBranch()
    const smokeBranch = 'smoke-branch'

    const branchDropdownButton = await $('.branch-button button')
    await branchDropdownButton.waitForDisplayed({ timeout: 15000 })
    await dismissMoveToApplicationsDialog()
    await branchDropdownButton.click()

    const newBranchButton = await $('.new-branch-button')
    await newBranchButton.waitForDisplayed({ timeout: 15000 })
    await newBranchButton.click()

    const createBranchDialog = await $('#create-branch')
    await createBranchDialog.waitForDisplayed({ timeout: 15000 })

    const branchNameInput = await createBranchDialog.$('input')
    await branchNameInput.waitForDisplayed({ timeout: 15000 })
    await browser.execute(
      (element, value) => {
        const input = element as HTMLInputElement
        const descriptor = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )
        descriptor?.set?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      },
      branchNameInput,
      smokeBranch
    )

    const createBranchButton = await createBranchDialog.$(
      '//button[normalize-space()="Create Branch" or normalize-space()="Create branch"]'
    )
    await createBranchButton.waitForDisplayed({ timeout: 15000 })
    await createBranchButton.click()

    await browser.waitUntil(
      async () => getSmokeRepoCurrentBranch() === smokeBranch,
      {
        timeout: 15000,
        timeoutMsg: 'Smoke repository did not switch to the new branch',
      }
    )

    await dismissMoveToApplicationsDialog()
    await branchDropdownButton.click()

    const originalBranchItem = await $(
      `//div[contains(@class, "branches-list-item")]//*[normalize-space()="${initialBranch}"]`
    )
    await originalBranchItem.waitForDisplayed({ timeout: 15000 })
    await originalBranchItem.click()

    await browser.waitUntil(
      async () => getSmokeRepoCurrentBranch() === initialBranch,
      {
        timeout: 15000,
        timeoutMsg:
          'Smoke repository did not switch back to the original branch',
      }
    )

    await browser.waitUntil(async () => getSmokeRepoStatus() === '', {
      timeout: 15000,
      timeoutMsg: 'Smoke repository was not clean after switching branches',
    })
  })
})

// ── Helpers for the mock update server control plane ────────────────────

function controlMockServer(action: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get(`${MOCK_CONTROL_URL}/${action}`, res => {
        let data = ''
        res.on('data', chunk => (data += chunk))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
  })
}

function getMockRequests(): Promise<
  ReadonlyArray<{ method: string; url: string }>
> {
  return controlMockServer('requests').then(JSON.parse)
}

// ── Auto-update ─────────────────────────────────────────────────────────

describe('Auto-update', () => {
  describe('startup update check', () => {
    it('sends an update check to the mock server on launch', async () => {
      // The app performs an update check shortly after launch. It should
      // have already hit the mock server by the time the smoke tests above
      // finished.
      await browser.waitUntil(
        async () => {
          const reqs = await getMockRequests()
          return reqs.some(r => r.method === 'GET' && r.url.includes('/update'))
        },
        {
          timeout: 30000,
          interval: 1000,
          timeoutMsg:
            'Expected the app to send a GET update check to the mock server',
        }
      )
    })

    it('does not show update banner when no update is available', async () => {
      // With the default "no-update" (HTTP 204), the banner should not
      // be visible.
      const banner = await $('#update-available')
      const isDisplayed = await banner.isDisplayed().catch(() => false)
      expect(isDisplayed).toBe(false)
    })
  })

  describe('About dialog', () => {
    it('shows the current version', async () => {
      await browser.execute(() => {
        require('electron').ipcRenderer.emit('menu-event', {}, 'show-about')
      })

      const aboutDialog = await $('#about')
      await aboutDialog.waitForDisplayed({
        timeout: 5000,
        timeoutMsg: 'About dialog did not appear',
      })

      // The version text is in <span class="selectable-text">Version X.Y.Z (arch)</span>
      const versionSpan = await aboutDialog.$('.selectable-text')
      const versionText = await versionSpan.getText()
      expect(versionText).toMatch(/Version \d+\.\d+\.\d+/)
    })

    it('shows up-to-date status after no-update check', async () => {
      const aboutDialog = await $('#about')
      const updateStatus = await aboutDialog.$('.update-status')
      await updateStatus.waitForDisplayed({ timeout: 10000 })

      const txt = await updateStatus.getText()
      expect(txt.toLowerCase()).toContain('you have the latest version')
    })

    it('closes the About dialog', async () => {
      // Submit the dialog form (the Close button is type="submit")
      const closeBtn = await $('#about button[type="submit"]')
      await closeBtn.click()

      const aboutDialog = await $('#about')
      await aboutDialog.waitForDisplayed({
        timeout: 5000,
        reverse: true,
        timeoutMsg: 'About dialog did not close',
      })
    })
  })

  describe('update available', () => {
    it('switches mock server to return an update', async () => {
      await controlMockServer('reset-requests')
      await controlMockServer('set-behavior/update-available')

      const behavior = await controlMockServer('behavior')
      expect(behavior).toBe('update-available')
    })

    it('triggers an update check and the app processes it', async () => {
      // Open About dialog and click "Check for Updates"
      await browser.execute(() => {
        require('electron').ipcRenderer.emit('menu-event', {}, 'show-about')
      })

      const aboutDialog = await $('#about')
      await aboutDialog.waitForDisplayed({ timeout: 5000 })

      const checkBtn = await aboutDialog.$(
        'button.button-component=Check for Updates'
      )
      if (await checkBtn.isExisting()) {
        await checkBtn.click()
      }

      // Wait for the About dialog to show a status change from the update
      // check — "Checking for updates…" or "Downloading update…" confirms
      // the app processed the mock's update-available JSON feed.
      const updateStatus = await aboutDialog.$('.update-status')
      await browser.waitUntil(
        async () => {
          const isDisplayed = await updateStatus
            .isDisplayed()
            .catch(() => false)
          if (!isDisplayed) {
            return false
          }
          const txt = (await updateStatus.getText()).toLowerCase()
          return (
            txt.includes('checking') ||
            txt.includes('downloading') ||
            txt.includes('ready to be installed')
          )
        },
        {
          timeout: 15000,
          interval: 1000,
          timeoutMsg: 'Expected About dialog to show update-in-progress status',
        }
      )

      // Close the dialog
      const closeBtn = await $('#about button[type="submit"]')
      await closeBtn.click()
      await aboutDialog
        .waitForDisplayed({ timeout: 5000, reverse: true })
        .catch(() => {})
    })

    it('sent update check requests to the mock server', async () => {
      const reqs = await getMockRequests()
      const updateReqs = reqs.filter(
        r => r.method === 'GET' && r.url.includes('/update')
      )
      expect(updateReqs.length).toBeGreaterThanOrEqual(1)
    })

    it('shows installing-update warning when quitting during download', async () => {
      // The app is currently in the "downloading update" state because the
      // mock server's download endpoint hangs forever. Attempting to quit
      // should trigger the installing-update dialog warning the user.
      await browser.execute(() => {
        require('electron').ipcRenderer.send('quit-app')
      })

      const installingDialog = await $('#installing-update')
      await installingDialog.waitForDisplayed({
        timeout: 5000,
        timeoutMsg: 'Installing update dialog did not appear when quitting',
      })

      // Verify the warning message is shown
      const message = await installingDialog.$('.updating-message')
      const messageText = await message.getText()
      expect(messageText).toContain(
        'Do not close GitHub Desktop while the update is in progress'
      )
    })

    it('restores mock to no-update', async () => {
      await controlMockServer('set-behavior/no-update')
      await controlMockServer('reset-requests')
    })

    it('quits the app via Quit Anyway', async () => {
      // Trigger quit again to re-show the installing-update dialog
      await browser.execute(() => {
        require('electron').ipcRenderer.send('quit-app')
      })

      const installingDialog = await $('#installing-update')
      await installingDialog.waitForDisplayed({ timeout: 5000 })

      const quitBtn = await installingDialog.$(
        '.button-group.destructive button[type="button"]'
      )
      await quitBtn.waitForClickable({ timeout: 5000 })

      // Get the Electron renderer process PID before clicking so we can
      // verify the app actually exits — without using WebDriver on the
      // dead session (which would hang).
      const rendererPid: number = await browser.execute(() => process.pid)

      await quitBtn.click()

      // Poll the OS to confirm the renderer process exited.
      // process.kill(pid, 0) throws when the process no longer exists.
      const deadline = Date.now() + 10000
      while (Date.now() < deadline) {
        try {
          process.kill(rendererPid, 0)
          await new Promise(r => setTimeout(r, 200))
        } catch {
          // Process is gone — app quit successfully
          return
        }
      }

      throw new Error(
        `Electron renderer process ${rendererPid} did not exit within 10 seconds`
      )
    })
  })
})
