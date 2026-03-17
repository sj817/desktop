#!/usr/bin/env ts-node

import * as Path from 'path'
import { spawnSync, SpawnSyncOptions } from 'child_process'

import glob from 'glob'
import { forceUnwrap } from '../app/src/lib/fatal-error'

const root = Path.dirname(__dirname)

const options: SpawnSyncOptions = {
  cwd: root,
  stdio: 'inherit',
}

const captureOutputOptions: SpawnSyncOptions = {
  cwd: root,
  encoding: 'utf8',
}

function findYarnVersion(callback: (path: string) => void) {
  glob('vendor/yarn-*.js', (error, files) => {
    if (error != null) {
      throw error
    }

    // this ensures the paths returned by glob are sorted alphabetically
    files.sort()

    // use the latest version here if multiple are found
    callback(forceUnwrap('Missing vendored yarn', files.at(-1)))
  })
}

findYarnVersion(path => {
  let result = spawnSync(
    'node',
    [path, '--cwd', 'app', 'install', '--force'],
    options
  )

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }

  result = spawnSync(
    'git',
    ['submodule', 'update', '--recursive', '--init'],
    options
  )

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }

  result = spawnSync('node', [path, 'compile:script'], options)

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }

  // Capture output here so CI failures include the Playwright-specific error.
  result = spawnSync(
    'npx',
    ['playwright', 'install', 'ffmpeg'],
    captureOutputOptions
  )

  if (result.status !== 0) {
    console.error(
      'Error: failed to install Playwright ffmpeg (video recording may not work)',
      '\nplatform:',
      process.platform,
      '\nstatus:',
      result.status,
      '\nsignal:',
      result.signal,
      '\nerror:',
      result.error,
      '\nstdout:',
      result.stdout,
      '\nstderr:',
      result.stderr
    )
  }
})
