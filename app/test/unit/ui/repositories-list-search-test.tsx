import { afterEach, before, describe, it, mock } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { Repository } from '../../../src/models/repository'
import { Dispatcher } from '../../../src/ui/dispatcher'
import type { ISectionFilterListProps } from '../../../src/ui/lib/section-filter-list'
import {
  IRepositoryListItem,
  RepositoryListGroup,
} from '../../../src/ui/repositories-list/group-repositories'
import {
  click,
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let RepositoriesList: typeof import('../../../src/ui/repositories-list/repositories-list').RepositoriesList
let latestSectionFilterListProps: ISectionFilterListProps<
  IRepositoryListItem,
  RepositoryListGroup
> | null = null
let unmount: (() => void) | undefined

mock.module('../../../src/ui/lib/section-filter-list', {
  namedExports: {
    SectionFilterList: (
      props: ISectionFilterListProps<IRepositoryListItem, RepositoryListGroup>
    ) => {
      latestSectionFilterListProps = props

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
          ...group.items.map(item =>
            props.renderItem(item, { title: [], subtitle: [] })
          ),
        ])
      )

      return (
        <div className="mock-section-filter-list">
          <button
            type="button"
            className="trigger-filter-change"
            onClick={() => props.onFilterTextChanged?.('desktop')}
          >
            Trigger Filter Change
          </button>
          <div className="rendered-groups">{rows}</div>
          <div className="no-items">
            {filteredGroups.length === 0 ? props.renderNoItems?.() : null}
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
  alias: string | null,
  ownerLogin = 'desktop',
  name = 'desktop'
) {
  return new Repository(
    path,
    id,
    createGitHubRepository(ownerLogin, name),
    false,
    alias
  )
}

function createDispatcher() {
  const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
  Object.assign(dispatcher, {
    recordRepoClicked: () => {},
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
    filterText?: string
    onFilterTextChanged?: (text: string) => void
  } = {}
) {
  const repositories = props.repositories ?? [
    createRepository('/tmp/workbench', 1, 'Workbench', 'desktop', 'desktop'),
    createRepository('/tmp/notifications', 2, null, 'desktop', 'notifications'),
  ]

  return renderComponent(
    <RepositoriesList
      selectedRepository={repositories[0] ?? null}
      repositories={repositories}
      recentRepositories={[]}
      localRepositoryStateLookup={new Map()}
      onSelectionChanged={() => {}}
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
      dispatcher={createDispatcher()}
    />
  )
}

describe('RepositoriesList search', () => {
  it('filters repositories using the searchable item text, including the GitHub full name', () => {
    const { container, unmount: u } = renderRepositoriesList({
      filterText: 'desktop/desktop',
    })
    unmount = u

    queryByTextOrThrow(container, '.filter-list-group-header', 'desktop')
    queryByTextOrThrow(container, '.repository-list-item .name', 'Workbench')
    assert.equal(container.querySelectorAll('.repository-list-item').length, 1)
    assert.equal(latestSectionFilterListProps?.filterText, 'desktop/desktop')
  })

  it('shows the no-results state for unmatched filters and forwards filter text changes', () => {
    const filterCalls = new Array<string>()
    const { container, unmount: u } = renderRepositoriesList({
      filterText: 'missing',
      onFilterTextChanged: text => {
        filterCalls.push(text)
      },
    })
    unmount = u

    queryByTextOrThrow(
      container,
      '.no-results-found .title',
      "Sorry, I can't find that repository"
    )
    queryByTextOrThrow(container, '.new-repository-button', 'Add')

    click(queryOrThrow<HTMLButtonElement>(container, '.trigger-filter-change'))

    assert.deepEqual(filterCalls, ['desktop'])
  })
})
