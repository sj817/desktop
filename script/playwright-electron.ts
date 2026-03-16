/**
 * Launch GitHub Desktop via Playwright for agent-driven UI verification.
 *
 * This script starts the app and keeps it running so that an agent can
 * interact with it using Playwright browser automation tools (click
 * elements, take screenshots, inspect the DOM, etc.).
 *
 * Set RECORD_VIDEO=1 to enable video recording of the session. The video
 * is saved to the project root when the app closes.
 *
 * Usage:
 *   npx ts-node -P script/tsconfig.json script/playwright-electron.ts
 *   RECORD_VIDEO=1 npx ts-node -P script/tsconfig.json script/playwright-electron.ts
 *
 * Prerequisites:
 *   yarn build:dev   # or yarn compile:dev — need out/main.js
 */

/* eslint-disable no-sync */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { _electron as electron } from 'playwright'

const projectRoot = path.resolve(__dirname, '..')
const appEntryPoint = path.join(projectRoot, 'out', 'main.js')
const userDataDir = path.join(os.tmpdir(), 'github-desktop-playwright-verify')
const videosDir = path.join(projectRoot, 'playwright-videos')

if (!fs.existsSync(appEntryPoint)) {
  console.error(
    `Error: Built app not found at ${appEntryPoint}\nRun 'yarn build:dev' or 'yarn compile:dev' first.`
  )
  process.exit(1)
}

fs.rmSync(userDataDir, { recursive: true, force: true })
fs.mkdirSync(userDataDir, { recursive: true })

const recordVideo = process.env.RECORD_VIDEO === '1'
const repoPath = process.argv[2] // Optional: path to a repo to open

async function main() {
  if (recordVideo) {
    fs.mkdirSync(videosDir, { recursive: true })
    console.log(
      `Video recording enabled — videos will be saved to ${videosDir}`
    )
  }

  const appArgs = [appEntryPoint, `--user-data-dir=${userDataDir}`]
  if (repoPath) {
    appArgs.push(`--cli-open=${repoPath}`)
    console.log(`Opening repository: ${repoPath}`)
  }

  console.log('Launching GitHub Desktop via Playwright…')
  const app = await electron.launch({
    args: appArgs,
    env: {
      ...process.env,
      // Isolate all user config so the agent doesn't read or modify the
      // developer's real settings.
      GIT_CONFIG_GLOBAL: path.join(userDataDir, '.gitconfig'),
      GIT_CONFIG_SYSTEM: path.join(userDataDir, '.gitconfig-system'),
      XDG_CONFIG_HOME: path.join(userDataDir, '.config'),
      // Prevent SSH from using the developer's real keys
      SSH_AUTH_SOCK: '',
      GIT_SSH_COMMAND: 'false',
    },
    recordVideo: recordVideo
      ? { dir: videosDir, size: { width: 1280, height: 800 } }
      : undefined,
    timeout: 30000,
  })

  const window = await app.firstWindow()
  console.log(`Window title: ${await window.title()}`)
  console.log(`Window URL:   ${window.url()}`)
  console.log('\nPlaywright Electron session is active.')
  console.log(
    'Use Playwright browser automation tools to interact with the app.'
  )
  console.log('Press Ctrl+C to close.\n')

  // When the process is interrupted, close gracefully so videos are flushed
  process.on('SIGINT', async () => {
    console.log('\nClosing app…')
    await app.close()

    if (recordVideo) {
      const video = window.video()
      if (video) {
        const videoPath = await video.path()
        console.log(`Video saved: ${videoPath}`)
      }
    }

    process.exit(0)
  })

  // Keep process alive until interrupted
  await new Promise(() => {})
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
