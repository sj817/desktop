import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as path from 'path'
import { existsSync } from 'fs'

import { clone } from '../../../src/lib/git/clone'
import { setupEmptyRepository } from '../../helpers/repositories'
import { makeCommit } from '../../helpers/repository-scaffolding'
import { createTempDirectory } from '../../helpers/temp'
import { exec } from 'dugite'

describe('git/clone', () => {
  it('clones a local repository', async t => {
    // Create a source repo with a commit
    const source = await setupEmptyRepository(t)
    await makeCommit(source, {
      entries: [{ path: 'README.md', contents: 'hello' }],
      commitMessage: 'initial commit',
    })

    const destPath = await createTempDirectory(t)
    const clonePath = path.join(destPath, 'cloned')

    await clone(source.path, clonePath, {})

    assert.equal(existsSync(path.join(clonePath, '.git')), true)
    assert.equal(existsSync(path.join(clonePath, 'README.md')), true)
  })

  it('clones with a specific branch', async t => {
    const source = await setupEmptyRepository(t)
    await makeCommit(source, {
      entries: [{ path: 'README.md', contents: 'hello' }],
      commitMessage: 'initial commit',
    })

    // Create a feature branch on the source
    await exec(['branch', 'feature'], source.path)
    await exec(['checkout', 'feature'], source.path)
    await makeCommit(source, {
      entries: [{ path: 'feature.txt', contents: 'feature' }],
      commitMessage: 'feature commit',
    })
    await exec(['checkout', 'master'], source.path)

    const destPath = await createTempDirectory(t)
    const clonePath = path.join(destPath, 'cloned')

    await clone(source.path, clonePath, { branch: 'feature' })

    // Verify the feature branch was checked out
    const result = await exec(['rev-parse', '--abbrev-ref', 'HEAD'], clonePath)
    assert.equal(result.stdout.trim(), 'feature')
    assert.equal(existsSync(path.join(clonePath, 'feature.txt')), true)
  })

  it('reports progress when callback is provided', async t => {
    const source = await setupEmptyRepository(t)
    await makeCommit(source, {
      entries: [{ path: 'README.md', contents: 'hello' }],
      commitMessage: 'initial commit',
    })

    const destPath = await createTempDirectory(t)
    const clonePath = path.join(destPath, 'cloned')

    const progressEvents: Array<{ kind: string }> = []
    await clone(source.path, clonePath, {}, progress => {
      progressEvents.push({ kind: progress.kind })
    })

    assert.ok(progressEvents.length > 0, 'Expected at least one progress event')
    assert.equal(progressEvents[0].kind, 'clone')
  })

  it('clones with a custom default branch name', async t => {
    const source = await setupEmptyRepository(t)
    await makeCommit(source, {
      entries: [{ path: 'README.md', contents: 'hello' }],
      commitMessage: 'initial commit',
    })

    const destPath = await createTempDirectory(t)
    const clonePath = path.join(destPath, 'cloned')

    await clone(source.path, clonePath, { defaultBranch: 'trunk' })

    assert.equal(existsSync(path.join(clonePath, '.git')), true)
  })
})
