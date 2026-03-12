/// <reference types="@wdio/globals/types" />

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
