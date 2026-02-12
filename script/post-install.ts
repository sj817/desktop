#!/usr/bin/env ts-node

import * as Path from 'path'
import { spawnSync, SpawnSyncOptions } from 'child_process'

const root = Path.dirname(__dirname)

const options: SpawnSyncOptions = {
  cwd: root,
  stdio: 'inherit',
  // On Windows, shell is needed to execute .cmd files
  shell: process.platform === 'win32',
}

let result = spawnSync('npm', ['install'], {
  ...options,
  cwd: Path.join(root, 'app'),
})

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

result = spawnSync('npm', ['run', 'compile:script'], options)

if (result.status !== 0) {
  process.exit(result.status || 1)
}
