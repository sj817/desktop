import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { DefaultCommitMessage } from '../../../src/models/commit-message'
import { ICommitContext } from '../../../src/models/commit'
import { Repository } from '../../../src/models/repository'
import { OversizedFiles } from '../../../src/ui/changes/oversized-files-warning'
import { Dispatcher } from '../../../src/ui/dispatcher'
import {
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined
let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect | undefined

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
    summary: 'Commit oversized files',
    description: 'Testing oversized file dialog flow',
  }
}

describe('OversizedFiles', () => {
  it('renders the oversized file paths and Git LFS recommendation', () => {
    originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        width: 480,
        height: 24,
        top: 0,
        left: 0,
        bottom: 24,
        right: 480,
        x: 0,
        y: 0,
        toJSON() {
          return this
        },
      }) as DOMRect

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
    assert.ok(container.textContent?.includes('The following files are over 100MB'))

    const link = queryOrThrow<HTMLAnchorElement>(container, 'a.link-button-component')
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

    const buttons = Array.from(container.querySelectorAll('button')).map(b =>
      b.textContent?.trim()
    )

    assert.ok(buttons.includes(__DARWIN__ ? 'Commit Anyway' : 'Commit anyway'))
    assert.ok(buttons.includes('Cancel'))
  })

  it('dismisses, commits included changes, and resets the commit message on submit', async () => {
    const repository = createRepository()
    const context = createCommitContext()
    const calls = new Array<string>()

    const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
    Object.assign(dispatcher, {
      commitIncludedChanges: async (repo: Repository, commitContext: ICommitContext) => {
        assert.equal(repo, repository)
        assert.equal(commitContext, context)
        calls.push('commit')
      },
      setCommitMessage: (repo: Repository, message: typeof DefaultCommitMessage) => {
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

    const form = queryOrThrow<HTMLFormElement>(container, 'form')
    form.dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    )

    await Promise.resolve()

    assert.deepEqual(calls, ['dismiss', 'commit', 'reset'])
  })
})