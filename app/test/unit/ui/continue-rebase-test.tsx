import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { RebaseConflictState } from '../../../src/lib/app-state'
import { Repository } from '../../../src/models/repository'
import {
  AppFileStatusKind,
  WorkingDirectoryStatus,
} from '../../../src/models/status'
import { ContinueRebase } from '../../../src/ui/changes/continue-rebase'
import { Dispatcher } from '../../../src/ui/dispatcher'
import {
  click,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { createMockFileChange } from '../../helpers/mock-git'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

function createRepository() {
  return new Repository('/tmp/desktop', 1, null, false)
}

function createRebaseConflictState(): RebaseConflictState {
  return {
    kind: 'rebase',
    currentTip: 'abc123',
    targetBranch: 'feature/tests',
    baseBranch: 'main',
    originalBranchTip: 'abc000',
    baseBranchTip: 'def000',
    manualResolutions: new Map(),
  }
}

describe('ContinueRebase', () => {
  it('does not continue the rebase while conflicted files remain', () => {
    let continueCalls = 0
    const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
    Object.assign(dispatcher, {
      continueRebase: async () => {
        continueCalls += 1
      },
    })

    const { container, unmount: u } = renderComponent(
      <ContinueRebase
        dispatcher={dispatcher}
        repository={createRepository()}
        workingDirectory={WorkingDirectoryStatus.fromFiles([
          createMockFileChange('conflicted.ts', AppFileStatusKind.Conflicted),
        ])}
        rebaseConflictState={createRebaseConflictState()}
        isCommitting={false}
        hasUntrackedChanges={false}
      />
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      'button.commit-button'
    )

    click(button)

    assert.equal(button.getAttribute('aria-disabled'), 'true')
    assert.equal(continueCalls, 0)
  })

  it('shows the rebasing state and warns about untracked files', () => {
    const { container, unmount: u } = renderComponent(
      <ContinueRebase
        dispatcher={Object.create(Dispatcher.prototype) as Dispatcher}
        repository={createRepository()}
        workingDirectory={WorkingDirectoryStatus.fromFiles([])}
        rebaseConflictState={createRebaseConflictState()}
        isCommitting={true}
        hasUntrackedChanges={true}
      />
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      'button.commit-button'
    )
    assert.equal(button.getAttribute('aria-disabled'), 'true')
    assert.ok(queryOrThrow(container, '.warning-untracked-files'))
    assert.ok(button.textContent?.includes('Rebasing'))
    assert.ok(container.querySelector('svg.spin'))
  })

  it('continues the rebase when the button is clicked and no conflicts remain', async () => {
    const repository = createRepository()
    const workingDirectory = WorkingDirectoryStatus.fromFiles([])
    const rebaseConflictState = createRebaseConflictState()
    const calls = new Array<{
      repository: Repository
      workingDirectory: WorkingDirectoryStatus
      rebaseConflictState: RebaseConflictState
      kind: string
    }>()

    const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
    Object.assign(dispatcher, {
      continueRebase: async (
        kind: string,
        repo: Repository,
        wd: WorkingDirectoryStatus,
        state: RebaseConflictState
      ) => {
        calls.push({
          kind,
          repository: repo,
          workingDirectory: wd,
          rebaseConflictState: state,
        })
      },
    })

    const { container, unmount: u } = renderComponent(
      <ContinueRebase
        dispatcher={dispatcher}
        repository={repository}
        workingDirectory={workingDirectory}
        rebaseConflictState={rebaseConflictState}
        isCommitting={false}
        hasUntrackedChanges={false}
      />
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      'button.commit-button'
    )

    click(button)

    assert.deepEqual(calls, [
      {
        kind: 'Rebase',
        repository,
        workingDirectory,
        rebaseConflictState,
      },
    ])
  })
})
