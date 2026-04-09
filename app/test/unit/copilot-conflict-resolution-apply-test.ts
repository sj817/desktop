import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as Path from 'path'
import * as os from 'os'
import { mkdtemp, readFile, mkdir, writeFile } from 'fs/promises'

import { applyCopilotResolutionsToWorkingDirectory } from '../../src/lib/copilot-conflict-resolution-apply'
import { IFileResolution } from '../../src/lib/copilot-conflict-resolution'

describe('applyCopilotResolutionsToWorkingDirectory', () => {
  async function createTempRepo(t: { after: (fn: () => void) => void }) {
    const dir = await mkdtemp(Path.join(os.tmpdir(), 'copilot-test-'))
    const { rm } = await import('fs/promises')
    t.after(async () => {
      await rm(dir, { recursive: true, force: true })
    })
    return dir
  }

  it('writes resolved content to the correct files', async t => {
    const repoPath = await createTempRepo(t)
    // Create a subdirectory so we can test nested paths
    await mkdir(Path.join(repoPath, 'src'), { recursive: true })
    // Create a pre-existing file to overwrite
    await writeFile(Path.join(repoPath, 'src', 'app.ts'), 'old content')

    const resolutions: IFileResolution[] = [
      {
        path: 'src/app.ts',
        resolvedContent: 'resolved content for app.ts',
        reasoning: 'Combined both changes',
      },
    ]

    const written = await applyCopilotResolutionsToWorkingDirectory(
      repoPath,
      resolutions
    )

    assert.equal(written, 1)
    const content = await readFile(Path.join(repoPath, 'src', 'app.ts'), 'utf8')
    assert.equal(content, 'resolved content for app.ts')
  })

  it('writes multiple files', async t => {
    const repoPath = await createTempRepo(t)
    await mkdir(Path.join(repoPath, 'src'), { recursive: true })
    await writeFile(Path.join(repoPath, 'src', 'a.ts'), 'old a')
    await writeFile(Path.join(repoPath, 'src', 'b.ts'), 'old b')

    const resolutions: IFileResolution[] = [
      {
        path: 'src/a.ts',
        resolvedContent: 'new a',
        reasoning: 'reason a',
      },
      {
        path: 'src/b.ts',
        resolvedContent: 'new b',
        reasoning: 'reason b',
      },
    ]

    const written = await applyCopilotResolutionsToWorkingDirectory(
      repoPath,
      resolutions
    )

    assert.equal(written, 2)
    assert.equal(
      await readFile(Path.join(repoPath, 'src', 'a.ts'), 'utf8'),
      'new a'
    )
    assert.equal(
      await readFile(Path.join(repoPath, 'src', 'b.ts'), 'utf8'),
      'new b'
    )
  })

  it('rejects absolute file paths', async t => {
    const repoPath = await createTempRepo(t)

    const resolutions: IFileResolution[] = [
      {
        path: '/etc/passwd',
        resolvedContent: 'malicious content',
        reasoning: 'reason',
      },
    ]

    await assert.rejects(
      () => applyCopilotResolutionsToWorkingDirectory(repoPath, resolutions),
      /absolute file path/i
    )
  })

  it('rejects path traversal attempts', async t => {
    const repoPath = await createTempRepo(t)

    const resolutions: IFileResolution[] = [
      {
        path: '../../../etc/hosts',
        resolvedContent: 'malicious content',
        reasoning: 'reason',
      },
    ]

    await assert.rejects(
      () => applyCopilotResolutionsToWorkingDirectory(repoPath, resolutions),
      /escapes repository root/i
    )
  })

  it('rejects sneaky path traversal with valid-looking prefix', async t => {
    const repoPath = await createTempRepo(t)

    const resolutions: IFileResolution[] = [
      {
        path: 'src/../../outside',
        resolvedContent: 'malicious content',
        reasoning: 'reason',
      },
    ]

    await assert.rejects(
      () => applyCopilotResolutionsToWorkingDirectory(repoPath, resolutions),
      /escapes repository root/i
    )
  })

  it('does not write any files if path validation fails', async t => {
    const repoPath = await createTempRepo(t)
    await mkdir(Path.join(repoPath, 'src'), { recursive: true })
    await writeFile(Path.join(repoPath, 'src', 'good.ts'), 'original')

    const resolutions: IFileResolution[] = [
      {
        path: 'src/good.ts',
        resolvedContent: 'should not be written',
        reasoning: 'reason',
      },
      {
        path: '../escape',
        resolvedContent: 'malicious',
        reasoning: 'reason',
      },
    ]

    await assert.rejects(() =>
      applyCopilotResolutionsToWorkingDirectory(repoPath, resolutions)
    )

    // The good file should NOT have been written since validation happens
    // before any writes.
    const content = await readFile(
      Path.join(repoPath, 'src', 'good.ts'),
      'utf8'
    )
    assert.equal(content, 'original')
  })

  it('returns 0 for empty resolutions array', async t => {
    const repoPath = await createTempRepo(t)

    const written = await applyCopilotResolutionsToWorkingDirectory(
      repoPath,
      []
    )

    assert.equal(written, 0)
  })
})
