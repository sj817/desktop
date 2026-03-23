import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import {
  click,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { NoPullRequests } from '../../../src/ui/branches/no-pull-requests'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

describe('NoPullRequests', () => {
  it('renders the search empty state and branch creation call to action on the default branch', () => {
    let branchClicks = 0

    const { container, unmount: u } = renderComponent(
      <NoPullRequests
        repositoryName="desktop"
        isOnDefaultBranch={true}
        isSearch={true}
        isLoadingPullRequests={false}
        onCreateBranch={() => {
          branchClicks += 1
        }}
        onCreatePullRequest={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    assert.ok(
      container.textContent?.includes("Sorry, I can't find that pull request!")
    )
    assert.ok(
      container.textContent?.includes('Would you like to create a new branch')
    )

    click(queryOrThrow(container, 'a.link-button-component'))

    assert.equal(branchClicks, 1)
  })

  it('renders the repository message and pull request creation call to action off the default branch', () => {
    let pullRequestClicks = 0

    const { container, unmount: u } = renderComponent(
      <NoPullRequests
        repositoryName="desktop"
        isOnDefaultBranch={false}
        isSearch={false}
        isLoadingPullRequests={false}
        onCreateBranch={() => {
          throw new Error('should not be called')
        }}
        onCreatePullRequest={() => {
          pullRequestClicks += 1
        }}
      />
    )
    unmount = u

    assert.ok(container.textContent?.includes("You're all set!"))
    assert.ok(
      container.textContent?.includes('No open pull requests in desktop')
    )
    assert.ok(
      queryOrThrow(container, '.ref-component').textContent?.includes('desktop')
    )
    assert.ok(
      container.textContent?.includes(
        'Would you like to create a pull request from the current branch?'
      )
    )

    click(queryOrThrow(container, 'a.link-button-component'))

    assert.equal(pullRequestClicks, 1)
  })

  it('renders the loading state without an action link while pull requests are loading', () => {
    const { container, unmount: u } = renderComponent(
      <NoPullRequests
        repositoryName="desktop"
        isOnDefaultBranch={true}
        isSearch={false}
        isLoadingPullRequests={true}
        onCreateBranch={() => {
          throw new Error('should not be called')
        }}
        onCreatePullRequest={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    assert.ok(container.textContent?.includes('Hang tight'))
    assert.ok(
      container.textContent?.includes('Loading pull requests as fast as I can!')
    )
    assert.equal(container.querySelector('a.link-button-component'), null)
  })
})
