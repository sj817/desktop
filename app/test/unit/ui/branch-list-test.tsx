import { afterEach, before, describe, it, mock } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { Branch, BranchType } from '../../../src/models/branch'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { Repository } from '../../../src/models/repository'
import { queryOrThrow, renderComponent } from '../../helpers/component-test-utils'

type MockSectionFilterListProps = React.ComponentProps<any>

let BranchList: typeof import('../../../src/ui/branches/branch-list').BranchList
let latestSectionFilterListProps: MockSectionFilterListProps | null = null
let unmount: (() => void) | undefined

mock.module('../../../src/ui/lib/section-filter-list', {
  namedExports: {
    SectionFilterList: React.forwardRef<any, MockSectionFilterListProps>(
      (props, ref) => {
        latestSectionFilterListProps = props

        React.useImperativeHandle(ref, () => ({
          selectNextItem: () => {},
        }))

        const rows = React.Children.toArray(
          props.groups.flatMap((group: any) => [
            props.renderGroupHeader?.(group.identifier),
            ...group.items.map((item: any) =>
              props.renderItem(item, { title: [], subtitle: [] })
            ),
          ])
        )

        return (
          <div className="mock-section-filter-list branches-list">
            <button
              type="button"
              className="trigger-item-click"
              onClick={() =>
                props.onItemClick?.(props.groups[0].items[0], {
                  kind: 'mouse',
                  event: { preventDefault: () => {} },
                })
              }
            >
              Trigger Item Click
            </button>
            <button
              type="button"
              className="trigger-selection-change"
              onClick={() =>
                props.onSelectionChanged?.(props.groups[0].items[0], {
                  kind: 'keyboard',
                  event: { key: 'ArrowDown' },
                })
              }
            >
              Trigger Selection Change
            </button>
            <div className="rendered-rows">{rows}</div>
            <div className="no-items">
              {props.groups.every((group: any) => group.items.length === 0)
                ? props.renderNoItems?.()
                : null}
            </div>
            <div className="post-filter">{props.renderPostFilter?.()}</div>
          </div>
        )
      }
    ),
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
    type === BranchType.Local ? `refs/heads/${name}` : `refs/remotes/origin/${name}`

  return new Branch(name, 'origin/main', { sha: `${name}-sha` }, type, ref)
}

function renderBranchList(props: {
  allBranches?: ReadonlyArray<Branch>
  recentBranches?: ReadonlyArray<Branch>
  defaultBranch?: Branch | null
  selectedBranch?: Branch | null
  filterText?: string
  canCreateNewBranch?: boolean
  onCreateNewBranch?: (name: string) => void
  onItemClick?: (branch: Branch) => void
  onSelectionChanged?: (branch: Branch | null) => void
  noBranchesMessage?: string
} = {}) {
  const defaultBranch =
    props.defaultBranch !== undefined ? props.defaultBranch : createBranch('main')
  const recentBranch = createBranch('release/1.0')
  const otherBranch = createBranch('feature/login')
  const allBranches = props.allBranches ?? [defaultBranch, recentBranch, otherBranch]
  const recentBranches = props.recentBranches ?? [recentBranch]

  const rendered = renderComponent(
    <BranchList
      repository={createRepository()}
      defaultBranch={defaultBranch}
      currentBranch={defaultBranch}
      allBranches={allBranches}
      recentBranches={recentBranches}
      selectedBranch={
        props.selectedBranch !== undefined ? props.selectedBranch : defaultBranch
      }
      filterText={props.filterText ?? 'topic'}
      onFilterTextChanged={() => {}}
      canCreateNewBranch={props.canCreateNewBranch ?? true}
      onCreateNewBranch={props.onCreateNewBranch}
      getBranchAriaLabel={item => item.branch.name}
      renderBranch={item => <div className="rendered-branch">{item.branch.name}</div>}
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

    assert.ok(container.textContent?.includes(__DARWIN__ ? 'Default Branch' : 'Default branch'))
    assert.ok(container.textContent?.includes(__DARWIN__ ? 'Recent Branches' : 'Recent branches'))
    assert.ok(container.textContent?.includes(__DARWIN__ ? 'Other Branches' : 'Other branches'))
    assert.equal(latestSectionFilterListProps?.selectedItem?.branch.name, defaultBranch.name)
  })

  it('maps item click and selection change callbacks back to Branch values', () => {
    const clicks = new Array<string>()
    const selections = new Array<string | null>()
    const { container, unmount: u, defaultBranch } = renderBranchList({
      onItemClick: branch => {
        clicks.push(branch.name)
      },
      onSelectionChanged: branch => {
        selections.push(branch?.name ?? null)
      },
    })
    unmount = u

    queryOrThrow<HTMLButtonElement>(container, '.trigger-item-click').click()
    queryOrThrow<HTMLButtonElement>(container, '.trigger-selection-change').click()

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
})