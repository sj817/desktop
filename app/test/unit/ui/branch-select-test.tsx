import { afterEach, before, describe, it, mock } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { Branch, BranchType } from '../../../src/models/branch'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { Repository } from '../../../src/models/repository'
import {
  BranchGroupIdentifier,
  IBranchListItem,
} from '../../../src/ui/branches/group-branches'
import type { ISectionFilterListProps } from '../../../src/ui/lib/section-filter-list'
import type { IPopoverDropdownProps } from '../../../src/ui/lib/popover-dropdown'
import {
  click,
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

interface IPopoverDropdownHandle {
  closePopover(): void
}

let latestSectionFilterListProps: ISectionFilterListProps<
  IBranchListItem,
  BranchGroupIdentifier
> | null = null
let closePopoverCalls = 0
let BranchSelect: typeof import('../../../src/ui/branches/branch-select').BranchSelect
let unmount: (() => void) | undefined

mock.module('../../../src/ui/lib/section-filter-list', {
  namedExports: {
    SectionFilterList: React.forwardRef<
      { selectNextItem: () => void },
      ISectionFilterListProps<IBranchListItem, BranchGroupIdentifier>
    >((props, ref) => {
      latestSectionFilterListProps = props

      React.useImperativeHandle(ref, () => ({
        selectNextItem: () => {},
      }))

      const filterText = (props.filterText ?? '').toLowerCase()
      const filteredGroups =
        filterText.length === 0
          ? props.groups
          : props.groups
              .map(group => ({
                ...group,
                items: group.items.filter(item =>
                  item.text.join(' ').toLowerCase().includes(filterText)
                ),
              }))
              .filter(group => group.items.length > 0)

      const rows = React.Children.toArray(
        filteredGroups.flatMap(group => [
          props.renderGroupHeader?.(group.identifier),
          ...group.items.map(item => (
            <div
              key={item.id}
              className="branch-row"
              data-branch-name={item.branch.name}
              onClick={event =>
                props.onItemClick?.(item, {
                  kind: 'mouseclick',
                  event,
                })
              }
            >
              {props.renderItem(item, { title: [], subtitle: [] })}
            </div>
          )),
        ])
      )

      return (
        <div className="mock-section-filter-list branches-list">
          <div className="filter-text">{props.filterText}</div>
          <div className="selected-branch">
            {props.selectedItem?.branch.name ?? ''}
          </div>
          <button
            type="button"
            className="change-filter"
            onClick={() => props.onFilterTextChanged?.('feature')}
          >
            Change Filter
          </button>
          <div className="rendered-rows">{rows}</div>
          <div className="no-items">
            {filteredGroups.length === 0 ? props.renderNoItems?.() : null}
          </div>
          <div className="post-filter">{props.renderPostFilter?.()}</div>
        </div>
      )
    }),
  },
})

mock.module('../../../src/lib/git/log', {
  namedExports: {
    getAuthors: async () => new Promise(() => {}),
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
  latestSectionFilterListProps = null
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
    branch?: Branch | null
    defaultBranch?: Branch | null
    allBranches?: ReadonlyArray<Branch>
    recentBranches?: ReadonlyArray<Branch>
  } = {}
) {
  const defaultBranch = props.defaultBranch ?? createBranch('main')
  const recentBranch = createBranch('release/1.0')
  const featureBranch = createBranch('feature/login')
  const branches = props.allBranches ?? [defaultBranch, recentBranch, featureBranch]
  const rendered = renderComponent(
    <BranchSelect
      repository={createRepository()}
      branch={props.branch ?? defaultBranch}
      defaultBranch={defaultBranch}
      currentBranch={defaultBranch ?? branches[0]}
      allBranches={branches}
      recentBranches={props.recentBranches ?? [recentBranch]}
      onChange={props.onChange}
      noBranchesMessage={props.noBranchesMessage}
    />
  )

  return { ...rendered, branches }
}

describe('BranchSelect', () => {
  it('renders the current selected branch in the popover button and shows the grouped real branch list', () => {
    const {
      container,
      unmount: u,
      branches,
    } = renderBranchSelect({
      noBranchesMessage: 'No branches available',
    })
    unmount = u

    queryByTextOrThrow(container, '.content-title', 'Choose a base branch')
    queryByTextOrThrow(container, '.popover-dropdown-button-label', 'base:')
    queryByTextOrThrow(
      container,
      '.filter-list-group-header',
      __DARWIN__ ? 'Default Branch' : 'Default branch'
    )
    queryByTextOrThrow(
      container,
      '.filter-list-group-header',
      __DARWIN__ ? 'Recent Branches' : 'Recent branches'
    )
    queryByTextOrThrow(
      container,
      '.filter-list-group-header',
      __DARWIN__ ? 'Other Branches' : 'Other branches'
    )
    queryByTextOrThrow(container, '.branches-list-item .name', branches[0].name)
    queryByTextOrThrow(container, '.branches-list-item .name', branches[1].name)
    queryByTextOrThrow(container, '.branches-list-item .name', branches[2].name)
    assert.equal(
      queryOrThrow<HTMLDivElement>(container, '.button-content').textContent?.replace(
        /\s+/g,
        ' '
      ).trim(),
      `base:${branches[0].name}`
    )
    assert.equal(
      latestSectionFilterListProps?.selectedItem?.branch.name,
      branches[0].name
    )
    assert.equal(
      queryOrThrow<HTMLDivElement>(container, '.post-filter').textContent?.trim(),
      ''
    )
  })

  it('updates the filter text passed to BranchList and narrows the real branch rows', () => {
    const { container, unmount: u } = renderBranchSelect()
    unmount = u

    click(queryOrThrow<HTMLButtonElement>(container, '.change-filter'))

    assert.equal(latestSectionFilterListProps?.filterText, 'feature')
    queryByTextOrThrow(container, '.filter-text', 'feature')
    queryByTextOrThrow(container, '.branches-list-item .name', 'feature/login')
    assert.equal(container.querySelectorAll('.branches-list-item .name').length, 1)
  })

  it('closes the popover, updates selection, and emits onChange when a rendered branch is clicked', () => {
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

    click(
      queryOrThrow<HTMLDivElement>(
        container,
        '.branch-row[data-branch-name="feature/login"]'
      )
    )

    assert.equal(closePopoverCalls, 1)
    assert.deepEqual(changes, [branches[2].name])
    assert.equal(
      latestSectionFilterListProps?.selectedItem?.branch.name,
      branches[2].name
    )
    assert.equal(
      queryOrThrow<HTMLDivElement>(container, '.button-content').textContent?.replace(
        /\s+/g,
        ' '
      ).trim(),
      `base:${branches[2].name}`
    )
  })
})
