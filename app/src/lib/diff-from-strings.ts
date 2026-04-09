import * as os from 'os'
import * as Path from 'path'
import { promises as fs } from 'fs'
import { git } from './git/core'
import { DiffParser } from './diff-parser'
import { DiffType, ITextDiff } from '../models/diff'
import { Repository } from '../models/repository'

const emptyTextDiff: ITextDiff = {
  kind: DiffType.Text,
  text: '',
  hunks: [],
  maxLineNumber: 0,
  hasHiddenBidiChars: false,
}

/**
 * Generate an `ITextDiff` from two strings using `git diff --no-index`.
 *
 * This is useful for comparing arbitrary content (e.g. a conflict-marker file
 * vs. Copilot's resolved version) without the content being tracked by git.
 *
 * Returns an empty text diff (zero hunks) when both strings are identical.
 */
export async function generateDiffFromStrings(
  repository: Repository,
  originalContent: string,
  resolvedContent: string,
  filePath: string
): Promise<ITextDiff> {
  if (originalContent === resolvedContent) {
    return emptyTextDiff
  }

  const tmpDir = await fs.mkdtemp(
    Path.join(os.tmpdir(), 'desktop-copilot-diff-')
  )
  const ext = Path.extname(filePath)
  const originalFile = Path.join(tmpDir, `original${ext}`)
  const resolvedFile = Path.join(tmpDir, `resolved${ext}`)

  try {
    await Promise.all([
      fs.writeFile(originalFile, originalContent, 'utf8'),
      fs.writeFile(resolvedFile, resolvedContent, 'utf8'),
    ])

    // git diff --no-index exits with 1 when files differ (not an error)
    const result = await git(
      [
        'diff',
        '--no-ext-diff',
        '--no-index',
        '--no-color',
        '--unified=3',
        '--',
        originalFile,
        resolvedFile,
      ],
      repository.path,
      'generateDiffFromStrings',
      { successExitCodes: new Set([0, 1]) }
    )

    if (!result.stdout.trim()) {
      return emptyTextDiff
    }

    const parser = new DiffParser()
    const rawDiff = parser.parse(result.stdout)

    return {
      kind: DiffType.Text,
      text: rawDiff.contents,
      hunks: rawDiff.hunks,
      maxLineNumber: rawDiff.maxLineNumber,
      hasHiddenBidiChars: rawDiff.hasHiddenBidiChars,
    }
  } finally {
    // Best-effort cleanup — don't let this mask a successful parse
    fs.rm(tmpDir, { recursive: true }).catch(() => {})
  }
}
