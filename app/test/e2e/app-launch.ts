/// <reference types="@wdio/globals/types" />

import { describe, it } from 'mocha'

import {
  resetDesktopWindowHandle,
  smokeRepoFileName,
  smokeRepoPath,
  switchToDesktopWindow,
} from './test-helpers'

/**
 * E2E Smoke Test: App Launch
 *
 * Verifies that GitHub Desktop launches and renders its initial UI.
 * This is the most basic smoke test — if this fails, the app is fundamentally broken.
 */
describe('GitHub Desktop - App Launch', () => {
  it('should launch and add a local repository', async () => {
    resetDesktopWindowHandle()
    await switchToDesktopWindow()

    const title = await browser.getTitle()
    expect(typeof title).toBe('string')

    // Wait for the body to have some content
    await browser.waitUntil(
      async () => {
        const body = await $('body')
        const html = await body.getHTML()
        return html.length > 50
      },
      { timeout: 15000, timeoutMsg: 'App did not render content within 15s' }
    )

    // Verify the page has rendered something
    const body = await $('body')
    const html = await body.getHTML()
    expect(html.length).toBeGreaterThan(50)

    const skipWelcomeButton = await $('a.skip-button')
    await skipWelcomeButton.waitForDisplayed({ timeout: 15000 })
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

    const noRepositoriesAddButton = await $(
      '//*[contains(normalize-space(), "Add an Existing Repository from your Local Drive") or contains(normalize-space(), "Add an Existing Repository from your local drive")]'
    )

    if (await noRepositoriesAddButton.isDisplayed().catch(() => false)) {
      await noRepositoriesAddButton.click()
    }

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

    const repoFile = await $(`//*[contains(normalize-space(), "${smokeRepoFileName}")]`)
    await repoFile.waitForDisplayed({ timeout: 15000 })
    await expect(repoFile).toBeDisplayed()
  })
})
