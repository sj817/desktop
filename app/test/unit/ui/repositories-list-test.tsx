import { afterEach, before, describe, it, mock } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import {
  ILocalRepositoryState,
  Repository,
} from '../../../src/models/repository'
import { Dispatcher } from '../../../src/ui/dispatcher'
import type { ISectionFilterListProps } from '../../../src/ui/lib/section-filter-list'
import {
  IRepositoryListItem,
  RepositoryListGroup,
} from '../../../src/ui/repositories-list/group-repositories'
import {
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let latestSectionFilterListProps: ISectionFilterListProps<
  IRepositoryListItem,
  RepositoryListGroup
> | null = null
let unmount: (() => void) | undefined
let RepositoriesList: typeof import('../../../src/ui/repositories-list/repositories-list').RepositoriesList

mock.module('../../../src/ui/lib/section-filter-list', {
  namedExports: {
    SectionFilterList: (
      props: ISectionFilterListProps<IRepositoryListItem, RepositoryListGroup>
    ) => {
      latestSectionFilterListProps = props

      const rows = props.groups.flatMap(group => [
        props.renderGroupHeader?.(group.identifier),
        ...group.items.map(item =>
          props.renderItem(item, { title: [], subtitle: [] })
        ),
      ])

      return (
        <div className="mock-section-filter-list">
          <div className="selected-item">
            {props.selectedItem?.repository.name ?? ''}
          </div>
          <button
            type="button"
            className="trigger-item-click"
            onClick={event =>
              props.onItemClick?.(props.groups[0].items[0], {
                kind: 'mouseclick',
                event,
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
                event: new KeyboardEvent('keydown', {
                  key: 'ArrowDown',
                }) as unknown as React.KeyboardEvent<any>,
              })
            }
          >
            Trigger Selection Change
          </button>
          <div className="rendered-groups">{rows}</div>
          <div className="no-items">
            {props.groups.length === 0 ? props.renderNoItems?.() : null}
          </div>
          <div className="post-filter">{props.renderPostFilter?.()}</div>
        </div>
      )
    },
  },
})

before(async () => {
  ;({ RepositoriesList } = await import(
    '../../../src/ui/repositories-list/repositories-list'
  ))
})

afterEach(() => {
  unmount?.()
  unmount = undefined
  latestSectionFilterListProps = null
})

function createGitHubRepository(ownerLogin: string, name: string) {
  return new GitHubRepository(
    name,
    new Owner(ownerLogin, 'https://github.com', 1),
    1,
    false,
    `https://github.com/${ownerLogin}/${name}`,
    `https://github.com/${ownerLogin}/${name}.git`
  )
}

function createRepository(
  path: string,
  id: number,
  gitHubRepository: GitHubRepository | null = null,
  alias: string | null = null
) {
  return new Repository(path, id, gitHubRepository, false, alias)
}

function createDispatcher(recorded: string[]) {
  const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
  Object.assign(dispatcher, {
    recordRepoClicked: (hasIndicator: boolean) => {
      recorded.push(`clicked:${hasIndicator}`)
    },
    showPopup: () => {
      throw new Error('should not be called')
    },
    changeRepositoryAlias: () => {
      throw new Error('should not be called')
    },
  })
  return dispatcher
}

function renderRepositoriesList(
  props: {
    repositories?: ReadonlyArray<Repository>
    selectedRepository?: Repository | null
    recentRepositories?: ReadonlyArray<number>
    localRepositoryStateLookup?: ReadonlyMap<number, ILocalRepositoryState>
    filterText?: string
    onSelectionChanged?: (repository: { readonly id: number }) => void
    onFilterTextChanged?: (text: string) => void
  } = {}
) {
  const recorded = new Array<string>()
  const repositories = props.repositories ?? [
    createRepository(
      '/tmp/desktop',
      1,
      createGitHubRepository('desktop', 'desktop')
    ),
    createRepository('/tmp/local-repo', 2, null),
  ]

  const localRepositoryStateLookup =
    props.localRepositoryStateLookup ??
    new Map<number, ILocalRepositoryState>([
      [1, { aheadBehind: { ahead: 2, behind: 1 }, changedFilesCount: 3 }],
      [2, { aheadBehind: null, changedFilesCount: 0 }],
    ])

  const rendered = renderComponent(
    <RepositoriesList
      selectedRepository={props.selectedRepository ?? repositories[0]}
      repositories={repositories}
      recentRepositories={props.recentRepositories ?? []}
      localRepositoryStateLookup={localRepositoryStateLookup}
      onSelectionChanged={props.onSelectionChanged ?? (() => {})}
      askForConfirmationOnRemoveRepository={true}
      onRemoveRepository={() => {
        throw new Error('should not be called')
      }}
      onShowRepository={() => {
        throw new Error('should not be called')
      }}
      onViewOnGitHub={() => {
        throw new Error('should not be called')
      }}
      onOpenInShell={() => {
        throw new Error('should not be called')
      }}
      onOpenInExternalEditor={() => {
        throw new Error('should not be called')
      }}
      onFilterTextChanged={props.onFilterTextChanged ?? (() => {})}
      filterText={props.filterText ?? ''}
      dispatcher={createDispatcher(recorded)}
    />
  )

  return {
    ...rendered,
    recorded,
    repositories,
  }
}

describe('RepositoriesList', () => {
  it('renders grouped repository headers and passes the selected item to the list', () => {
    const { container, unmount: u, repositories } = renderRepositoriesList()
    unmount = u

    assert.ok(container.textContent?.includes('desktop'))
    assert.ok(container.textContent?.includes('Other'))
    assert.ok(container.textContent?.includes('local-repo'))
    assert.equal(
      latestSectionFilterListProps?.selectedItem?.repository.id,
      repositories[0].id
    )
  })

  it('renders the empty filtered state when no repositories match', () => {
    const filterCalls = new Array<string>()

    const { container, unmount: u } = renderRepositoriesList({
      repositories: [],
      selectedRepository: null,
      localRepositoryStateLookup: new Map(),
      filterText: 'missing',
      onFilterTextChanged: text => {
        filterCalls.push(text)
      },
    })
    unmount = u

    assert.ok(
      container.textContent?.includes("Sorry, I can't find that repository")
    )
    assert.ok(container.querySelector('.new-repository-button'))
    assert.deepEqual(filterCalls, [])
  })

  it('records indicator clicks and notifies selection changes for clicked repositories', () => {
    const selectionCalls = new Array<number>()
    const {
      container,
      unmount: u,
      recorded,
      repositories,
    } = renderRepositoriesList({
      onSelectionChanged: repository => {
        selectionCalls.push(repository.id)
      },
    })
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      '.trigger-item-click'
    )
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    assert.deepEqual(recorded, ['clicked:true'])
    assert.deepEqual(selectionCalls, [repositories[0].id])
  })
})
