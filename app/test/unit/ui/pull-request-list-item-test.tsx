import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { APICheckConclusion, APICheckStatus } from '../../../src/lib/api'
import { ICombinedRefCheck } from '../../../src/lib/ci-checks/ci-checks'
import { dragAndDropManager } from '../../../src/lib/drag-and-drop-manager'
import { formatRelative } from '../../../src/lib/format-relative'
import { GitHubRepository } from '../../../src/models/github-repository'
import { DragType, DropTargetType } from '../../../src/models/drag-drop'
import { Owner } from '../../../src/models/owner'
import { PullRequestListItem } from '../../../src/ui/branches/pull-request-list-item'
import { Dispatcher } from '../../../src/ui/dispatcher'
import {
  mouseOut,
  mouseOver,
  mouseUp,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  dragAndDropManager.setDragData(null)
  dragAndDropManager.dragEnded(undefined)
})

function createRepository() {
  return new GitHubRepository(
    'desktop',
    new Owner('desktop', 'https://api.github.com', 1),
    1
  )
}

function createCombinedCheck(): ICombinedRefCheck {
  return {
    status: APICheckStatus.Completed,
    conclusion: APICheckConclusion.Success,
    checks: [
      {
        id: 1,
        name: 'build',
        description: 'Successful',
        status: APICheckStatus.Completed,
        conclusion: APICheckConclusion.Success,
        appName: 'GitHub Actions',
        htmlUrl: null,
        checkSuiteId: null,
      },
    ],
  }
}

function createDispatcher() {
  const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher

  Object.assign(dispatcher, {
    tryGetCommitStatus: () => createCombinedCheck(),
    subscribeToCommitStatus: () => ({
      dispose() {},
    }),
  })

  return dispatcher
}

describe('PullRequestListItem', () => {
  it('renders the pull request title, subtitle, and CI status for an open pull request', () => {
    const created = new Date(Date.now() - 60_000)
    const expectedSubtitle = `#42 opened ${formatRelative(
      created.getTime() - Date.now()
    )} by mona`

    const { container, unmount: u } = renderComponent(
      <PullRequestListItem
        title="Improve test harness"
        number={42}
        created={created}
        author="mona"
        draft={false}
        matches={{ title: [], subtitle: [] }}
        dispatcher={createDispatcher()}
        repository={createRepository()}
        onDropOntoPullRequest={() => {
          throw new Error('should not be called')
        }}
        onMouseEnter={() => {
          throw new Error('should not be called')
        }}
        onMouseLeave={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const row = queryOrThrow<HTMLDivElement>(container, '.pull-request-item')
    assert.ok(row.classList.contains('open'))
    assert.ok(container.textContent?.includes('Improve test harness'))
    assert.ok(container.textContent?.includes(expectedSubtitle))
    assert.ok(
      container.querySelector('.ci-status-container .ci-status-success')
    )
  })

  it('renders loading state without title or subtitle text', () => {
    const { container, unmount: u } = renderComponent(
      <PullRequestListItem
        title="Hidden while loading"
        number={7}
        created={new Date()}
        author="mona"
        draft={false}
        loading={true}
        matches={{ title: [], subtitle: [] }}
        dispatcher={createDispatcher()}
        repository={createRepository()}
        onDropOntoPullRequest={() => {
          throw new Error('should not be called')
        }}
        onMouseEnter={() => {
          throw new Error('should not be called')
        }}
        onMouseLeave={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const row = queryOrThrow<HTMLDivElement>(container, '.pull-request-item')
    assert.ok(row.classList.contains('loading'))
    assert.equal(queryOrThrow(container, '.title').textContent, '')
    assert.equal(queryOrThrow(container, '.subtitle').textContent, '')
  })

  it('reports hover position and accepts commit drops', () => {
    const enteredTargets = new Array<string>()
    const disposeEnter = dragAndDropManager.onEnterDropTarget(target => {
      if (target.type === DropTargetType.Branch) {
        enteredTargets.push(target.branchName)
      }
    })

    const hoverCalls = new Array<{ number: number; top: number }>()
    const leaveEvents = new Array<Event>()
    const dropCalls = new Array<number>()

    const { container, unmount: u } = renderComponent(
      <PullRequestListItem
        title="Improve test harness"
        number={9}
        created={new Date()}
        author="mona"
        draft={true}
        matches={{ title: [], subtitle: [] }}
        dispatcher={createDispatcher()}
        repository={createRepository()}
        onDropOntoPullRequest={pullRequestNumber => {
          dropCalls.push(pullRequestNumber)
        }}
        onMouseEnter={(pullRequestNumber, top) => {
          hoverCalls.push({ number: pullRequestNumber, top })
        }}
        onMouseLeave={event => {
          leaveEvents.push(event.nativeEvent)
        }}
      />
    )
    unmount = () => {
      disposeEnter.dispose()
      u()
    }

    dragAndDropManager.setDragData({ type: DragType.Commit, commits: [] })
    dragAndDropManager.dragStarted()

    const row = queryOrThrow<HTMLDivElement>(container, '.pull-request-item')
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 37 }),
    })

    mouseOver(row)

    assert.ok(
      queryOrThrow<HTMLDivElement>(
        container,
        '.pull-request-item'
      ).classList.contains('drop-target')
    )
    assert.deepEqual(hoverCalls, [{ number: 9, top: 37 }])
    assert.deepEqual(enteredTargets, ['Improve test harness'])

    mouseUp(row)
    mouseOut(row)

    assert.deepEqual(dropCalls, [9])
    assert.equal(leaveEvents.length, 1)
  })
})
