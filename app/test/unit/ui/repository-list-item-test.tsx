import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { IAheadBehind } from '../../../src/models/branch'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { Repository } from '../../../src/models/repository'
import { RepositoryListItem } from '../../../src/ui/repositories-list/repository-list-item'
import {
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})

function createRepository(alias: string | null = null) {
  const owner = new Owner('desktop', 'https://github.com', 1)
  const gitHubRepository = new GitHubRepository(
    'desktop',
    owner,
    1,
    false,
    'https://github.com/desktop/desktop',
    'https://github.com/desktop/desktop.git'
  )

  return new Repository(
    '/tmp/projects/desktop',
    1,
    gitHubRepository,
    false,
    alias
  )
}

function renderRepositoryListItem(props: {
  repository?: Repository
  needsDisambiguation?: boolean
  matches?: { title: number[]; subtitle: number[] }
  aheadBehind?: IAheadBehind | null
  changedFilesCount?: number
} = {}) {
  return renderComponent(
    <RepositoryListItem
      repository={props.repository ?? createRepository()}
      needsDisambiguation={props.needsDisambiguation ?? false}
      matches={props.matches ?? { title: [], subtitle: [] }}
      aheadBehind={props.aheadBehind ?? null}
      changedFilesCount={props.changedFilesCount ?? 0}
    />
  )
}

describe('RepositoryListItem', () => {
  it('renders the disambiguation prefix and alias title', () => {
    const { container, unmount: u } = renderRepositoryListItem({
      repository: createRepository('Desktop App'),
      needsDisambiguation: true,
      matches: { title: [0, 1, 2], subtitle: [] },
    })
    unmount = u

    const name = queryOrThrow(container, '.name.alias')
    const prefix = queryOrThrow(container, '.prefix')
    const highlights = Array.from(name.querySelectorAll('mark')).map(mark =>
      mark.textContent
    )

    assert.equal(prefix.textContent, 'desktop/')
    assert.ok(name.textContent?.includes('Desktop App'))
    assert.deepEqual(highlights, ['Des'])
    assert.ok(container.querySelector('.icon-for-repository'))
  })

  it('renders ahead/behind and change indicators when present', () => {
    const { container, unmount: u } = renderRepositoryListItem({
      aheadBehind: { ahead: 2, behind: 1 },
      changedFilesCount: 3,
    })
    unmount = u

    const indicators = queryOrThrow(container, '.repo-indicators')
    const aheadBehind = queryOrThrow(indicators, '.ahead-behind')
    const changeIndicator = queryOrThrow(indicators, '.change-indicator-wrapper')

    assert.equal(aheadBehind.querySelectorAll('svg').length, 2)
    assert.equal(changeIndicator.querySelectorAll('svg').length, 1)
  })

  it('omits repository indicators when there is no divergence or uncommitted work', () => {
    const { container, unmount: u } = renderRepositoryListItem({
      aheadBehind: { ahead: 0, behind: 0 },
      changedFilesCount: 0,
    })
    unmount = u

    const indicators = queryOrThrow(container, '.repo-indicators')

    assert.equal(indicators.querySelector('.ahead-behind'), null)
    assert.equal(indicators.querySelector('.change-indicator-wrapper'), null)
  })
})