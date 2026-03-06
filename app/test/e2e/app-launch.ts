/**
 * E2E Smoke Test: App Launch
 *
 * Verifies that GitHub Desktop launches and renders its initial UI.
 * This is the most basic smoke test — if this fails, the app is fundamentally broken.
 */
describe('GitHub Desktop - App Launch', () => {
  it('should launch and render the application window', async () => {
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
  })
})
