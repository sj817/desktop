import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { ICommitContext } from '../../../src/models/commit'
import { DefaultCommitMessage } from '../../../src/models/commit-message'
import { Repository } from '../../../src/models/repository'
import { AppFileStatusKind } from '../../../src/models/status'
import { CommitConflictsWarning } from '../../../src/ui/merge-conflicts/commit-conflicts-warning'
import { Dispatcher } from '../../../src/ui/dispatcher'
import { click, renderComponent } from '../../helpers/component-test-utils'
import { createMockFileChange } from '../../helpers/mock-git'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})

function createRepository() {
  return new Repository('/tmp/desktop', 1, null, false)
}

function createCommitContext(): ICommitContext {
  return {
    summary: 'Commit conflicted files',
    description: 'Preserve the selected conflict resolution state',
    amend: true,
    trailers: [{ token: 'Co-Authored-By', value: 'Mona <mona@example.com>' }],
  }
}

function findButtonByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    element => element.textContent?.trim() === text
  )

  assert.ok(button, `Expected button with text ${text}`)
  return button as HTMLButtonElement
}

describe('CommitConflictsWarning actions', () => {
  it('commits the provided context when the destructive confirmation button is clicked', async () => {
    const repository = createRepository()
    const context = createCommitContext()
    const calls = new Array<string>()
    let submittedContext: ICommitContext | null = null

    const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
    Object.assign(dispatcher, {
      commitIncludedChanges: async (
        repo: Repository,
        commitContext: ICommitContext
      ) => {
        assert.equal(repo, repository)
        submittedContext = commitContext
        calls.push('commit')
      },
      clearBanner: () => {
        calls.push('clear')
      },
      setCommitMessage: (
        repo: Repository,
        message: typeof DefaultCommitMessage
      ) => {
        assert.equal(repo, repository)
        assert.deepEqual(message, DefaultCommitMessage)
        calls.push('reset')
      },
    })

    const { container, unmount: u } = renderComponent(
      <CommitConflictsWarning
        dispatcher={dispatcher}
        files={[
          createMockFileChange(
            'src/conflicted.ts',
            AppFileStatusKind.Conflicted
          ),
        ]}
        repository={repository}
        context={context}
        onDismissed={() => {
          calls.push('dismiss')
        }}
      />
    )
    unmount = u

    click(
      findButtonByText(
        container,
        __DARWIN__ ? 'Yes, Commit Files' : 'Yes, commit files'
      )
    )

    await Promise.resolve()

    assert.deepEqual(submittedContext, context)
    assert.deepEqual(calls, ['dismiss', 'commit', 'clear', 'reset'])
  })
})
