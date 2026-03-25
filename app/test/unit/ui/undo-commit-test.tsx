import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { Emoji } from '../../../src/lib/emoji'
import { Commit } from '../../../src/models/commit'
import { CommitIdentity } from '../../../src/models/commit-identity'
import { UndoCommit } from '../../../src/ui/changes/undo-commit'
import {
  queryByTextOrThrow,
  click,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

function createCommit(summary: string) {
  const identity = new CommitIdentity(
    'Mona Lisa',
    'mona@example.com',
    new Date(Date.now() - 60_000)
  )

  return new Commit(
    '1234567890abcdef',
    '1234567',
    summary,
    '',
    identity,
    identity,
    ['abcdef1234567890'],
    [],
    []
  )
}

describe('UndoCommit', () => {
  it('renders the commit summary and undo group metadata', () => {
    const { container, unmount: u } = renderComponent(
      <UndoCommit
        onUndo={() => {
          throw new Error('should not be called')
        }}
        commit={createCommit('Refine smoke tests')}
        emoji={new Map<string, Emoji>()}
        isPushPullFetchInProgress={false}
        isCommitting={false}
      />
    )
    unmount = u

    const root = queryOrThrow<HTMLDivElement>(container, '#undo-commit')
    assert.equal(root.getAttribute('role'), 'group')
    assert.equal(root.getAttribute('aria-label'), 'Undo commit')
    assert.ok(
      queryOrThrow<HTMLDivElement>(container, '.ago').textContent?.startsWith(
        'Committed'
      )
    )
    queryByTextOrThrow(container, '.summary', 'Refine smoke tests')
  })

  it('invokes onUndo when the undo button is clicked', () => {
    let undoCalls = 0

    const { container, unmount: u } = renderComponent(
      <UndoCommit
        onUndo={() => {
          undoCalls += 1
        }}
        commit={createCommit('Undo me')}
        emoji={new Map<string, Emoji>()}
        isPushPullFetchInProgress={false}
        isCommitting={false}
      />
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      'button.small-button'
    )
    click(button)

    assert.equal(undoCalls, 1)
  })

  it('disables undo while repository updates are in progress', () => {
    let undoCalls = 0

    const { container, unmount: u } = renderComponent(
      <UndoCommit
        onUndo={() => {
          undoCalls += 1
        }}
        commit={createCommit('Blocked undo')}
        emoji={new Map<string, Emoji>()}
        isPushPullFetchInProgress={true}
        isCommitting={false}
      />
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      'button.small-button'
    )
    click(button)

    assert.equal(button.getAttribute('aria-disabled'), 'true')
    assert.equal(undoCalls, 0)
    assert.equal(button.textContent, 'Undo')
  })
})
