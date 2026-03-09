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
import {
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

type MockSectionFilterListProps = ISectionFilterListProps<
  IBranchListItem,
  BranchGroupIdentifier
>

let BranchList: typeof import('../../../src/ui/branches/branch-list').BranchList
let latestSectionFilterListProps: MockSectionFilterListProps | null = null
let unmount: (() => void) | undefined

mock.module('../../../src/ui/lib/section-filter-list', {
  namedExports: {
    SectionFilterList: React.forwardRef<
      { selectNextItem: () => void },
      MockSectionFilterListProps
    >((props, ref) => {
      latestSectionFilterListProps = props

      React.useImperativeHandle(ref, () => ({
        selectNextItem: () => {},
      }))

      const filterText = props.filterText.toLowerCase()
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
          ...group.items.map(item =>
            props.renderItem(item, { title: [], subtitle: [] })
          ),
        ])
      )

      return (
        <div className="mock-section-filter-list branches-list">
          <div className="selected-item">
            {props.selectedItem?.branch.name ?? ''}
          </div>
          <button
            type="button"
            className="trigger-item-click"
            onClick={() =>
              filteredGroups.length > 0
                ? props.onItemClick?.(filteredGroups[0].items[0], {
                    kind: 'mouse',
                    event: { preventDefault: () => {} },
                  })
                : null
            }
          >
            Trigger Item Click
          </button>
          <button
            type="button"
            className="trigger-selection-change"
            onClick={() =>
              filteredGroups.length > 0
                ? props.onSelectionChanged?.(filteredGroups[0].items[0], {
                    kind: 'keyboard',
                    event: { key: 'ArrowDown' },
                  })
                : null
            }
          >
            Trigger Selection Change
          </button>
          <button
            type="button"
            className="trigger-filter-change"
            onClick={() => props.onFilterTextChanged?.('release')}
          >
            Trigger Filter Change
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
    getAuthors: async (_repository: Repository, shas: string[]) =>
      shas.map((sha, index) => ({
        name: `Author ${index}`,
        email: `author${index}@example.com`,
        date: new Date(`2024-01-0${index + 1}T12:00:00.000Z`),
        tzOffset: 0,
        toString: () => sha,
      })),
  },
})

before(async () => {
  ;({ BranchList } = await import('../../../src/ui/branches/branch-list'))
})

afterEach(() => {
  unmount?.()
  unmount = undefined
  latestSectionFilterListProps = null
})

function createRepository() {
  return new Repository(
    '/tmp/desktop',
    1,
    new GitHubRepository(
      'desktop',
      new Owner('desktop', 'https://github.com', 1),
      1,
      false,
      'https://github.com/desktop/desktop',
      'https://github.com/desktop/desktop.git'
    ),
    false
  )
}

function createBranch(name: string, type = BranchType.Local) {
  const ref =
    type === BranchType.Local
      ? `refs/heads/${name}`
      : `refs/remotes/origin/${name}`

  return new Branch(name, 'origin/main', { sha: `${name}-sha` }, type, ref)
}

function renderBranchList(
  props: {
    allBranches?: ReadonlyArray<Branch>
    recentBranches?: ReadonlyArray<Branch>
    defaultBranch?: Branch | null
    selectedBranch?: Branch | null
    filterText?: string
    canCreateNewBranch?: boolean
    onCreateNewBranch?: (name: string) => void
    onItemClick?: (branch: Branch) => void
    onSelectionChanged?: (branch: Branch | null) => void
    onFilterTextChanged?: (text: string) => void
    noBranchesMessage?: string
  } = {}
) {
  const defaultBranch =
    props.defaultBranch !== undefined
      ? props.defaultBranch
      : createBranch('main')
  const recentBranch = createBranch('release/1.0')
  const otherBranch = createBranch('feature/login')
  const allBranches =
    props.allBranches ??
    [defaultBranch, recentBranch, otherBranch].filter(
      (branch): branch is Branch => branch !== null
    )
  const recentBranches = props.recentBranches ?? [recentBranch]

  const rendered = renderComponent(
    <BranchList
      repository={createRepository()}
      defaultBranch={defaultBranch}
      currentBranch={defaultBranch}
      allBranches={allBranches}
      recentBranches={recentBranches}
      selectedBranch={
        props.selectedBranch !== undefined
          ? props.selectedBranch
          : defaultBranch
      }
      filterText={props.filterText ?? ''}
      onFilterTextChanged={props.onFilterTextChanged ?? (() => {})}
      canCreateNewBranch={props.canCreateNewBranch ?? true}
      onCreateNewBranch={props.onCreateNewBranch}
      getBranchAriaLabel={item => item.branch.name}
      renderBranch={item => (
        <div className="rendered-branch">{item.branch.name}</div>
      )}
      onItemClick={branch => {
        props.onItemClick?.(branch)
      }}
      onSelectionChanged={branch => {
        props.onSelectionChanged?.(branch)
      }}
      noBranchesMessage={props.noBranchesMessage}
    />
  )

  return {
    ...rendered,
    defaultBranch,
    recentBranch,
    otherBranch,
  }
}

describe('BranchList', () => {
  it('renders grouped branch headers and forwards the selected branch to the filter list', () => {
    const { container, unmount: u, defaultBranch } = renderBranchList()
    unmount = u

    if (defaultBranch === null) {
      throw new Error('Expected default branch to be present')
    }

    assert.ok(
      container.textContent?.includes(
        __DARWIN__ ? 'Default Branch' : 'Default branch'
      )
    )
    assert.ok(
      container.textContent?.includes(
        __DARWIN__ ? 'Recent Branches' : 'Recent branches'
      )
    )
    assert.ok(
      container.textContent?.includes(
        __DARWIN__ ? 'Other Branches' : 'Other branches'
      )
    )
    assert.equal(
      latestSectionFilterListProps?.selectedItem?.branch.name,
      defaultBranch.name
    )
  })

  it('maps item click and selection change callbacks back to Branch values', () => {
    const clicks = new Array<string>()
    const selections = new Array<string | null>()
    const {
      container,
      unmount: u,
      defaultBranch,
    } = renderBranchList({
      onItemClick: branch => {
        clicks.push(branch.name)
      },
      onSelectionChanged: branch => {
        selections.push(branch?.name ?? null)
      },
    })
    unmount = u

    if (defaultBranch === null) {
      throw new Error('Expected default branch to be present')
    }

    queryOrThrow<HTMLButtonElement>(container, '.trigger-item-click').click()
    queryOrThrow<HTMLButtonElement>(
      container,
      '.trigger-selection-change'
    ).click()

    assert.deepEqual(clicks, [defaultBranch.name])
    assert.deepEqual(selections, [defaultBranch.name])
  })

  it('renders the no branches state and creates a new branch from the current filter text', () => {
    const creations = new Array<string>()
    const { container, unmount: u } = renderBranchList({
      allBranches: [],
      recentBranches: [],
      defaultBranch: null,
      selectedBranch: null,
      filterText: 'feature/new-branch',
      onCreateNewBranch: name => {
        creations.push(name)
      },
    })
    unmount = u

    const createButton = queryOrThrow<HTMLButtonElement>(
      container,
      '.create-branch-button'
    )

    createButton.click()

    assert.deepEqual(creations, ['feature/new-branch'])
  })

  it('filters branches using the branch name text and only renders matching groups', () => {
    const { container, unmount: u } = renderBranchList({
      filterText: 'release',
    })
    unmount = u

    assert.ok(
      container.textContent?.includes(
        __DARWIN__ ? 'Recent Branches' : 'Recent branches'
      )
    )
    assert.ok(container.textContent?.includes('release/1.0'))
    assert.equal(
      container.textContent?.includes(
        __DARWIN__ ? 'Default Branch' : 'Default branch'
      ),
      false
    )
    assert.equal(
      container.textContent?.includes(
        __DARWIN__ ? 'Other Branches' : 'Other branches'
      ),
      false
    )
    assert.equal(container.textContent?.includes('feature/login'), false)
  })

  it('shows the filtered no-results state and forwards filter text changes', () => {
    const filterCalls = new Array<string>()
    const { container, unmount: u } = renderBranchList({
      filterText: 'missing-branch',
      onFilterTextChanged: text => {
        filterCalls.push(text)
      },
    })
    unmount = u

    assert.ok(container.querySelector('.create-branch-button'))

    queryOrThrow<HTMLButtonElement>(container, '.trigger-filter-change').click()

    assert.deepEqual(filterCalls, ['release'])
  })
})
