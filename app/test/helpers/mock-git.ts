import {
  IGitResult,
  IGitStringResult,
} from '../../src/lib/git/core'
import { GitError as DugiteError } from 'dugite'
import { IStatusResult } from '../../src/lib/git/status'
import {
  WorkingDirectoryStatus,
  WorkingDirectoryFileChange,
  AppFileStatusKind,
} from '../../src/models/status'
import { DiffSelection, DiffSelectionType } from '../../src/models/diff'

/**
 * Creates a mock IGitStringResult with sensible defaults.
 * Override any fields by passing a partial object.
 */
export function createMockGitResult(
  overrides: Partial<IGitStringResult> = {}
): IGitStringResult {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    gitError: null,
    gitErrorDescription: null,
    path: '/mock/repo',
    ...overrides,
  }
}

/**
 * Creates a mock IGitResult representing a failure.
 */
export function createMockGitError(
  gitError: DugiteError,
  overrides: Partial<IGitStringResult> = {}
): IGitStringResult {
  return createMockGitResult({
    exitCode: 1,
    gitError,
    gitErrorDescription: `Git error: ${gitError}`,
    ...overrides,
  })
}

/**
 * Creates a mock WorkingDirectoryFileChange for use in status results.
 */
export function createMockFileChange(
  path: string,
  kind: AppFileStatusKind = AppFileStatusKind.Modified
): WorkingDirectoryFileChange {
  return new WorkingDirectoryFileChange(
    path,
    { kind },
    DiffSelection.fromInitialSelection(DiffSelectionType.All)
  )
}

/**
 * Creates a mock IStatusResult with sensible defaults for a clean repository.
 */
export function createMockStatusResult(
  overrides: Partial<IStatusResult> = {}
): IStatusResult {
  return {
    currentBranch: 'main',
    currentTip: 'abc1234567890',
    currentUpstreamBranch: 'origin/main',
    branchAheadBehind: { ahead: 0, behind: 0 },
    exists: true,
    mergeHeadFound: false,
    squashMsgFound: false,
    rebaseInternalState: null,
    isCherryPickingHeadFound: false,
    workingDirectory: WorkingDirectoryStatus.fromFiles([]),
    doConflictedFilesExist: false,
    ...overrides,
  }
}

/**
 * Creates a mock IStatusResult with the specified changed files.
 */
export function createMockStatusWithFiles(
  files: ReadonlyArray<WorkingDirectoryFileChange>,
  overrides: Partial<IStatusResult> = {}
): IStatusResult {
  return createMockStatusResult({
    workingDirectory: WorkingDirectoryStatus.fromFiles(
      files as WorkingDirectoryFileChange[]
    ),
    ...overrides,
  })
}
