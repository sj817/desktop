import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { DefaultCommitMessage } from '../../../src/models/commit-message'
import { ICommitContext } from '../../../src/models/commit'
import { Repository } from '../../../src/models/repository'
import { OversizedFiles } from '../../../src/ui/changes/oversized-files-warning'
import { Dispatcher } from '../../../src/ui/dispatcher'
import {
  buttonWithText,
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
  stubElementBoundingRect,
  submit,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined
let restoreBoundingRectStub: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined

  restoreBoundingRectStub?.()
  restoreBoundingRectStub = undefined
})

function createRepository() {
  return new Repository('/tmp/desktop', 1, null, false)
}

function createCommitContext(): ICommitContext {
  return {
    summary: 'Commit oversized files',
    description: 'Testing oversized file dialog flow',
  }
}

describe('OversizedFiles', () => {
  it('renders the oversized file paths and Git LFS recommendation', () => {
    restoreBoundingRectStub = stubElementBoundingRect(480)

    const { container, unmount: u } = renderComponent(
      <OversizedFiles
        oversizedFiles={['large/video.mov', 'archive/bundle.zip']}
        onDismissed={() => {
          throw new Error('should not be called')
        }}
        dispatcher={Object.create(Dispatcher.prototype) as Dispatcher}
        context={createCommitContext()}
        repository={createRepository()}
      />
    )
    unmount = u

    const rows = Array.from(container.querySelectorAll('.files-list li'))
    const renderedPaths = rows.map(row => {
      const dirname = row.querySelector('.dirname')?.textContent ?? ''
      const filename = row.querySelector('.filename')?.textContent ?? ''
      return `${dirname}${filename}`
    })

    assert.ok(renderedPaths.includes('large/video.mov'))
    assert.ok(renderedPaths.includes('archive/bundle.zip'))
    queryByTextOrThrow(
      container,
      '.dialog-content p',
      'The following files are over 100MB. If you commit these files, you will no longer be able to push this repository to GitHub.com.'
    )

    const link = queryOrThrow<HTMLAnchorElement>(
      container,
      'a.link-button-component'
    )
    assert.equal(
      link.href,
      'https://help.github.com/articles/versioning-large-files/'
    )
    assert.equal(link.textContent, 'Git LFS')
  })

  it('renders the destructive commit action in the footer', () => {
    const { container, unmount: u } = renderComponent(
      <OversizedFiles
        oversizedFiles={['large/video.mov']}
        onDismissed={() => {
          throw new Error('should not be called')
        }}
        dispatcher={Object.create(Dispatcher.prototype) as Dispatcher}
        context={createCommitContext()}
        repository={createRepository()}
      />
    )
    unmount = u

    assert.ok(
      buttonWithText(container, __DARWIN__ ? 'Commit Anyway' : 'Commit anyway')
    )
    assert.ok(buttonWithText(container, 'Cancel'))
  })

  it('dismisses, commits included changes, and resets the commit message on submit', async () => {
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
      <OversizedFiles
        oversizedFiles={['large/video.mov']}
        onDismissed={() => {
          calls.push('dismiss')
        }}
        dispatcher={dispatcher}
        context={context}
        repository={repository}
      />
    )
    unmount = u

    submit(queryOrThrow<HTMLFormElement>(container, 'form'))

    await Promise.resolve()

    assert.deepEqual(calls, ['dismiss', 'commit', 'reset'])
  })
})
