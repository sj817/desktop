import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { DefaultCommitMessage } from '../../../src/models/commit-message'
import { ICommitContext } from '../../../src/models/commit'
import { Repository } from '../../../src/models/repository'
import { AppFileStatusKind } from '../../../src/models/status'
import { DialogStackContext } from '../../../src/ui/dialog/dialog'
import { CommitConflictsWarning } from '../../../src/ui/merge-conflicts/commit-conflicts-warning'
import { Dispatcher } from '../../../src/ui/dispatcher'
import { createMockFileChange } from '../../helpers/mock-git'
import {
  buttonWithText,
  keyDown,
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
  submit,
  waitForDuration,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined
let originalGetBoundingClientRect:
  | typeof HTMLElement.prototype.getBoundingClientRect
  | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined

  if (originalGetBoundingClientRect !== undefined) {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    originalGetBoundingClientRect = undefined
  }
})

function createRepository() {
  return new Repository('/tmp/desktop', 1, null, false)
}

function createCommitContext(): ICommitContext {
  return {
    summary: 'Commit conflicted files',
    description: 'Testing conflicted commit warning flow',
  }
}

function stubElementWidth(width: number) {
  originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      width,
      height: 24,
      top: 0,
      left: 0,
      bottom: 24,
      right: width,
      x: 0,
      y: 0,
      toJSON() {
        return this
      },
    } as DOMRect)
}

describe('CommitConflictsWarning', () => {
  it('renders the conflicted files and destructive commit action', () => {
    stubElementWidth(480)

    const files = [
      createMockFileChange('src/conflicted.ts', AppFileStatusKind.Conflicted),
      createMockFileChange('docs/merge.md', AppFileStatusKind.Conflicted),
    ]

    const { container, unmount: u } = renderComponent(
      <CommitConflictsWarning
        dispatcher={Object.create(Dispatcher.prototype) as Dispatcher}
        files={files}
        repository={createRepository()}
        context={createCommitContext()}
        onDismissed={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    queryByTextOrThrow(
      container,
      '.dialog-header h1',
      'Confirm committing conflicted files'
    )
    queryByTextOrThrow(
      container,
      '.dialog-content p:last-of-type',
      'Are you sure you want to commit these conflicted files?'
    )

    const renderedPaths = Array.from(
      container.querySelectorAll('.conflicted-files-text li')
    ).map(row => {
      const dirname = row.querySelector('.dirname')?.textContent ?? ''
      const filename = row.querySelector('.filename')?.textContent ?? ''
      return `${dirname}${filename}`
    })

    assert.ok(renderedPaths.includes('src/conflicted.ts'))
    assert.ok(renderedPaths.includes('docs/merge.md'))

    assert.ok(
      buttonWithText(
        container,
        __DARWIN__ ? 'Yes, Commit Files' : 'Yes, commit files'
      )
    )
    assert.ok(buttonWithText(container, 'Cancel'))
  })

  it('dismisses, commits, clears the banner, and resets the commit message on submit', async () => {
    const repository = createRepository()
    const context = createCommitContext()
    const calls = new Array<string>()

    const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
    Object.assign(dispatcher, {
      commitIncludedChanges: async (
        repo: Repository,
        commitContext: ICommitContext
      ) => {
        assert.equal(repo, repository)
        assert.equal(commitContext, context)
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

    submit(queryOrThrow<HTMLFormElement>(container, 'form'))

    await Promise.resolve()

    assert.deepEqual(calls, ['dismiss', 'commit', 'clear', 'reset'])
  })

  it('dismisses the dialog on Escape after the appearance grace period', async () => {
    const calls = new Array<string>()

    const { container, unmount: u } = renderComponent(
      <DialogStackContext.Provider value={{ isTopMost: true }}>
        <CommitConflictsWarning
          dispatcher={Object.create(Dispatcher.prototype) as Dispatcher}
          files={[
            createMockFileChange(
              'src/conflicted.ts',
              AppFileStatusKind.Conflicted
            ),
          ]}
          repository={createRepository()}
          context={createCommitContext()}
          onDismissed={() => {
            calls.push('dismiss')
          }}
        />
      </DialogStackContext.Provider>
    )
    unmount = u

    await waitForDuration(300)

    const dialog = queryOrThrow<HTMLElement>(container, 'dialog')
    keyDown(dialog, 'Escape')

    assert.deepEqual(calls, ['dismiss'])
  })
})
