import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { click, queryOrThrow, renderComponent } from '../../helpers/component-test-utils'
import { APICheckConclusion, APICheckStatus } from '../../../src/lib/api'
import { ICombinedRefCheck } from '../../../src/lib/ci-checks/ci-checks'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { PullRequestBadge } from '../../../src/ui/branches/pull-request-badge'
import { Dispatcher } from '../../../src/ui/dispatcher'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

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

function createDispatcher(check: ICombinedRefCheck | null) {
  const tryGetRefs = new Array<string>()
  const subscribeRefs = new Array<string>()
  let disposed = false

  const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher

  Object.assign(dispatcher, {
    tryGetCommitStatus: (_repository: GitHubRepository, ref: string) => {
      tryGetRefs.push(ref)
      return check
    },
    subscribeToCommitStatus: (_repository: GitHubRepository, ref: string) => {
      subscribeRefs.push(ref)
      return {
        dispose() {
          disposed = true
        },
      }
    },
  })

  return {
    dispatcher,
    tryGetRefs,
    subscribeRefs,
    wasDisposed: () => disposed,
  }
}

describe('PullRequestBadge', () => {
  it('subscribes to the pull request ref and releases the badge ref on unmount', () => {
    const refs = new Array<HTMLButtonElement | null>()
    const dispatcher = createDispatcher(null)

    const { unmount: u } = renderComponent(
      <PullRequestBadge
        number={42}
        dispatcher={dispatcher.dispatcher}
        repository={createRepository()}
        onBadgeRef={ref => refs.push(ref)}
      />
    )
    unmount = u

    assert.deepEqual(dispatcher.tryGetRefs, ['refs/pull/42/head'])
    assert.deepEqual(dispatcher.subscribeRefs, ['refs/pull/42/head'])
    assert.ok(refs[0] instanceof HTMLButtonElement)

    u()
    unmount = undefined

    assert.equal(refs[1], null)
    assert.equal(dispatcher.wasDisposed(), true)
  })

  it('does not invoke the badge click handler when no status is available', () => {
    let clicks = 0
    const dispatcher = createDispatcher(null)

    const { container, unmount: u } = renderComponent(
      <PullRequestBadge
        number={18}
        dispatcher={dispatcher.dispatcher}
        repository={createRepository()}
        onBadgeClick={() => {
          clicks += 1
        }}
      />
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(container, 'button.pr-badge')

    assert.equal(button.getAttribute('aria-disabled'), 'true')
    click(button)

    assert.equal(clicks, 0)
  })

  it('invokes the badge click handler when a status is available', () => {
    let clicks = 0
    const dispatcher = createDispatcher(createCombinedCheck())

    const { container, unmount: u } = renderComponent(
      <PullRequestBadge
        number={7}
        dispatcher={dispatcher.dispatcher}
        repository={createRepository()}
        showCIStatusPopover={true}
        onBadgeClick={() => {
          clicks += 1
        }}
      />
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(container, 'button.pr-badge')

    assert.equal(button.getAttribute('aria-disabled'), null)
    assert.equal(button.getAttribute('aria-expanded'), 'true')
    assert.ok(container.querySelector('.ci-status'))

    click(button)

    assert.equal(clicks, 1)
  })
})