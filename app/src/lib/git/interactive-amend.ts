import { appendFile, rm } from 'fs/promises'
import { getCommits, revRange } from '.'
import { MultiCommitOperationKind } from '../../models/multi-commit-operation'
import { IMultiCommitOperationProgress } from '../../models/progress'
import { Repository } from '../../models/repository'
import { getTempFilePath } from '../file-system'
import { rebaseInteractive, RebaseResult } from './rebase'

/**
 * Amend provided commits by calling interactive rebase.
 *
 * This will replay all commits in the log from the last retained commit.
 *
 * @param commitsToAmend - commits to amend
 * @param lastRetainedCommitRef - sha of commit before commits to reorder or null
 * if base commit for reordering is the root (first in history) of the branch
 */
export async function interactiveAmend(
  repository: Repository,
  commitsToAmend: ReadonlyArray<string>,
  lastRetainedCommitRef: string | null,
  progressCallback?: (progress: IMultiCommitOperationProgress) => void
): Promise<RebaseResult> {
  let todoPath
  let result: RebaseResult

  try {
    if (commitsToAmend.length === 0) {
      throw new Error('[interactiveAmend] No commits provided to amend.')
    }

    const toAmendShas = new Set(commitsToAmend)

    const commits = await getCommits(
      repository,
      lastRetainedCommitRef === null
        ? undefined
        : revRange(lastRetainedCommitRef, 'HEAD')
    )

    if (commits.length === 0) {
      throw new Error(
        '[interactiveAmend] Could not find commits in log for earliest commit.'
      )
    }

    todoPath = await getTempFilePath('interactiveAmendTodo')

    // Traversed in reverse so we do oldest to newest (replay commits)
    for (let i = commits.length - 1; i >= 0; i--) {
      const commit = commits[i]
      if (toAmendShas.has(commit.sha)) {
        await appendFile(todoPath, `edit ${commit.sha} ${commit.summary}\n`)
        continue
      }

      await appendFile(todoPath, `pick ${commit.sha} ${commit.summary}\n`)
    }

    result = await rebaseInteractive(
      repository,
      todoPath,
      lastRetainedCommitRef,
      MultiCommitOperationKind.RemediateSecret,
      'Remediate Secrets',
      progressCallback,
      commits
    )
  } catch (e) {
    log.error(e)
    return RebaseResult.Error
  } finally {
    if (todoPath !== undefined) {
      await rm(todoPath, { recursive: true, force: true })
    }
  }

  return result
}
