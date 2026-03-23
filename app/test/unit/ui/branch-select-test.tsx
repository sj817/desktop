import { afterEach, before, describe, it, mock } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { Branch, BranchType } from '../../../src/models/branch'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { Repository } from '../../../src/models/repository'
import type { IBranchListProps } from '../../../src/ui/branches/branch-list'
import type { IPopoverDropdownProps } from '../../../src/ui/lib/popover-dropdown'
import {
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

interface IPopoverDropdownHandle {
  closePopover(): void
}

let latestBranchListProps: IBranchListProps | null = null
let closePopoverCalls = 0
let BranchSelect: typeof import('../../../src/ui/branches/branch-select').BranchSelect
let unmount: (() => void) | undefined

mock.module('../../../src/ui/branches/branch-list', {
  namedExports: {
    BranchList: (props: IBranchListProps) => {
      latestBranchListProps = props
      const renderedBranch = props.renderBranch(
        {
          text: [props.selectedBranch?.name ?? ''],
          id: props.selectedBranch?.name ?? 'selected-branch',
          branch: props.selectedBranch ?? props.allBranches[0],
        },
        { title: [], subtitle: [] },
        undefined
      )

      return (
        <div className="mock-branch-list">
          <div className="filter-text">{props.filterText}</div>
          <div className="selected-branch">
            {props.selectedBranch?.name ?? ''}
          </div>
          <div className="can-create-new-branch">
            {String(props.canCreateNewBranch)}
          </div>
          <div className="rendered-branch">{renderedBranch}</div>
          <div className="no-branches-message">
            {props.noBranchesMessage ?? null}
          </div>
          <button
            type="button"
            className="change-filter"
            onClick={() => props.onFilterTextChanged('feature')}
          >
            Change Filter
          </button>
          <button
            type="button"
            className="select-second-branch"
            onClick={event => {
              const branch = props.allBranches[1]
              if (branch !== undefined) {
                props.onItemClick?.(branch, {
                  kind: 'mouseclick',
                  event,
                })
              }
            }}
          >
            Select Branch
          </button>
        </div>
      )
    },
  },
})

mock.module('../../../src/ui/lib/popover-dropdown', {
  namedExports: {
    PopoverDropdown: React.forwardRef<
      IPopoverDropdownHandle,
      IPopoverDropdownProps
    >((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        closePopover: () => {
          closePopoverCalls += 1
        },
      }))

      return (
        <div className="mock-popover-dropdown">
          <div className="button-content">{props.buttonContent}</div>
          <div className="content-title">{props.contentTitle}</div>
          {props.children}
        </div>
      )
    }),
  },
})

before(async () => {
  ;({ BranchSelect } = await import('../../../src/ui/branches/branch-select'))
})

afterEach(() => {
  unmount?.()
  unmount = undefined
  latestBranchListProps = null
  closePopoverCalls = 0
})

function createRepository() {
  const gitHubRepository = new GitHubRepository(
    'desktop',
    new Owner('desktop', 'https://github.com', 1),
    1,
    false,
    'https://github.com/desktop/desktop',
    'https://github.com/desktop/desktop.git'
  )

  return new Repository('/tmp/desktop', 1, gitHubRepository, false)
}

function createBranch(name: string) {
  return new Branch(
    name,
    'origin/main',
    { sha: `${name}-sha` },
    BranchType.Local,
    `refs/heads/${name}`
  )
}

function renderBranchSelect(
  props: {
    onChange?: (branch: Branch) => void
    noBranchesMessage?: string
  } = {}
) {
  const branches = [createBranch('main'), createBranch('feature/login')]
  const rendered = renderComponent(
    <BranchSelect
      repository={createRepository()}
      branch={branches[0]}
      defaultBranch={branches[0]}
      currentBranch={branches[0]}
      allBranches={branches}
      recentBranches={[branches[1]]}
      onChange={props.onChange}
      noBranchesMessage={props.noBranchesMessage}
    />
  )

  return { ...rendered, branches }
}

describe('BranchSelect', () => {
  it('renders the current selected branch in the popover button and forwards props to BranchList', () => {
    const {
      container,
      unmount: u,
      branches,
    } = renderBranchSelect({
      noBranchesMessage: 'No branches available',
    })
    unmount = u

    assert.ok(container.textContent?.includes('Choose a base branch'))
    assert.ok(container.textContent?.includes('base:'))
    assert.ok(container.textContent?.includes(branches[0].name))
    assert.equal(latestBranchListProps?.selectedBranch?.name, branches[0].name)
    assert.equal(latestBranchListProps?.canCreateNewBranch, false)
    assert.equal(
      latestBranchListProps?.noBranchesMessage,
      'No branches available'
    )
  })

  it('updates the filter text passed to BranchList', () => {
    const { container, unmount: u } = renderBranchSelect()
    unmount = u

    queryOrThrow<HTMLButtonElement>(container, '.change-filter').click()

    assert.equal(latestBranchListProps?.filterText, 'feature')
    assert.ok(container.textContent?.includes('feature'))
  })

  it('closes the popover, updates selection, and emits onChange when a branch is clicked', () => {
    const changes = new Array<string>()
    const {
      container,
      unmount: u,
      branches,
    } = renderBranchSelect({
      onChange: branch => {
        changes.push(branch.name)
      },
    })
    unmount = u

    queryOrThrow<HTMLButtonElement>(container, '.select-second-branch').click()

    assert.equal(closePopoverCalls, 1)
    assert.deepEqual(changes, [branches[1].name])
    assert.equal(latestBranchListProps?.selectedBranch?.name, branches[1].name)
    assert.ok(container.textContent?.includes(branches[1].name))
  })
})
