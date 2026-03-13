/**
 * Playwright helper for ad-hoc agent-driven UI verification.
 *
 * This script launches GitHub Desktop in Electron via Playwright and opens
 * an interactive REPL where agents (or developers) can explore the UI,
 * take screenshots, and verify visual changes.
 *
 * Usage:
 *   yarn playwright:launch              # launch app and open REPL
 *   yarn playwright:screenshot          # launch, take a screenshot, exit
 *
 * Prerequisites:
 *   yarn build:dev   # or yarn compile:dev — need out/main.js
 */

/* eslint-disable no-sync */

import path from 'path'
import fs from 'fs'
import { _electron as electron } from 'playwright'

const projectRoot = path.resolve(__dirname, '..')
const appEntryPoint = path.join(projectRoot, 'out', 'main.js')
const userDataDir = path.join(
  require('os').tmpdir(),
  'github-desktop-playwright-verify'
)

if (!fs.existsSync(appEntryPoint)) {
  console.error(
    `Error: Built app not found at ${appEntryPoint}\nRun 'yarn build:dev' or 'yarn compile:dev' first.`
  )
  process.exit(1)
}

fs.rmSync(userDataDir, { recursive: true, force: true })
fs.mkdirSync(userDataDir, { recursive: true })

async function main() {
  const mode = process.argv[2] ?? 'launch'

  console.log('Launching GitHub Desktop via Playwright…')
  const app = await electron.launch({
    args: [appEntryPoint, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      // Isolate git config from the developer's real config
      GIT_CONFIG_GLOBAL: path.join(userDataDir, '.gitconfig'),
      GIT_CONFIG_SYSTEM: path.join(userDataDir, '.gitconfig-system'),
    },
  })

  const window = await app.firstWindow()
  console.log(`Window title: ${await window.title()}`)
  console.log(`Window URL:   ${window.url()}`)

  if (mode === 'screenshot') {
    // Wait for the app to render
    await window.waitForLoadState('domcontentloaded')
    await window.waitForTimeout(3000)

    const screenshotPath = path.join(projectRoot, 'screenshot.png')
    await window.screenshot({ path: screenshotPath })
    console.log(`Screenshot saved to ${screenshotPath}`)

    await app.close()
    process.exit(0)
  }

  // Interactive mode — keep the app open
  console.log('\n=== Playwright Electron session active ===')
  console.log('The app is running. You can use Playwright MCP tools to')
  console.log('interact with it, or press Ctrl+C to close.\n')
  console.log('Useful Playwright page methods:')
  console.log('  await page.screenshot({ path: "screenshot.png" })')
  console.log('  await page.locator("#selector").click()')
  console.log('  await page.locator("text=Button").click()')
  console.log('  const html = await page.content()')
  console.log('')

  // Keep process alive
  await new Promise(() => {})
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
