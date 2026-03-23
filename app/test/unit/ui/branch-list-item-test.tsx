import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import { dragAndDropManager } from '../../../src/lib/drag-and-drop-manager'
import { DragType, DropTargetType } from '../../../src/models/drag-drop'
import { BranchListItem } from '../../../src/ui/branches/branch-list-item'
import {
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  dragAndDropManager.setDragData(null)
  dragAndDropManager.dragEnded(undefined)
})

describe('BranchListItem', () => {
  it('renders the branch name without a relative-time description when no date is provided', () => {
    const { container, unmount: u } = renderComponent(
      <BranchListItem
        name="feature/tests"
        isCurrentBranch={false}
        matches={{ title: [], subtitle: [] }}
        authorDate={undefined}
      />
    )
    unmount = u

    assert.ok(container.textContent?.includes('feature/tests'))
    assert.equal(container.querySelector('.description'), null)
  })

  it('marks a branch as a drop target and calls onDropOntoBranch for commit drags', () => {
    const enteredTargets = new Array<string>()
    const disposeEnter = dragAndDropManager.onEnterDropTarget(target => {
      if (target.type === DropTargetType.Branch) {
        enteredTargets.push(target.branchName)
      }
    })

    let droppedOnBranch: string | null = null

    const { container, unmount: u } = renderComponent(
      <BranchListItem
        name="release/1.0"
        isCurrentBranch={false}
        matches={{ title: [], subtitle: [] }}
        authorDate={undefined}
        onDropOntoBranch={branchName => {
          droppedOnBranch = branchName
        }}
      />
    )
    unmount = () => {
      disposeEnter.dispose()
      u()
    }

    dragAndDropManager.setDragData({ type: DragType.Commit, commits: [] })
    dragAndDropManager.dragStarted()

    const row = queryOrThrow<HTMLDivElement>(container, '.branches-list-item')

    act(() => {
      row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })

    assert.ok(
      queryOrThrow<HTMLDivElement>(
        container,
        '.branches-list-item'
      ).classList.contains('drop-target')
    )
    assert.deepEqual(enteredTargets, ['release/1.0'])

    act(() => {
      row.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    assert.equal(droppedOnBranch, 'release/1.0')
  })

  it('calls onDropOntoCurrentBranch when a commit is dropped on the current branch', () => {
    let currentBranchDrops = 0
    let otherBranchDrops = 0

    const { container, unmount: u } = renderComponent(
      <BranchListItem
        name="main"
        isCurrentBranch={true}
        matches={{ title: [], subtitle: [] }}
        authorDate={undefined}
        onDropOntoBranch={() => {
          otherBranchDrops += 1
        }}
        onDropOntoCurrentBranch={() => {
          currentBranchDrops += 1
        }}
      />
    )
    unmount = u

    dragAndDropManager.setDragData({ type: DragType.Commit, commits: [] })
    dragAndDropManager.dragStarted()

    const row = queryOrThrow<HTMLDivElement>(container, '.branches-list-item')

    act(() => {
      row.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    assert.equal(currentBranchDrops, 1)
    assert.equal(otherBranchDrops, 0)
  })
})
