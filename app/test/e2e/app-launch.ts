/// <reference types="@wdio/globals/types" />

import { describe, it } from 'mocha'

let desktopWindowHandle: string | null = null

async function switchToDesktopWindow() {
  if (desktopWindowHandle !== null) {
    await browser.switchToWindow(desktopWindowHandle)
    return
  }

  const handles = await browser.getWindowHandles()
  let bestHandle: string | null = null
  let bestHtmlLength = -1

  for (const handle of handles) {
    await browser.switchToWindow(handle)
    const url = await browser.getUrl()
    if (url.startsWith('devtools://')) {
      continue
    }

    const body = await $('body')
    const html = await body.getHTML().catch(() => '')

    if (html.length > bestHtmlLength) {
      bestHandle = handle
      bestHtmlLength = html.length
    }
  }

  if (bestHandle !== null) {
    desktopWindowHandle = bestHandle
    await browser.switchToWindow(bestHandle)
  }
}

/**
 * E2E Smoke Test: App Launch
 *
 * Verifies that GitHub Desktop launches and renders its initial UI.
 * This is the most basic smoke test — if this fails, the app is fundamentally broken.
 */
describe('GitHub Desktop - App Launch', () => {
  it('should launch and render the application window', async () => {
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
    desktopWindowHandle = await browser.getWindowHandle()
  })
})
