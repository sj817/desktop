import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import { APICheckConclusion, APICheckStatus } from '../../../src/lib/api'
import { ICombinedRefCheck } from '../../../src/lib/ci-checks/ci-checks'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { CIStatus } from '../../../src/ui/branches/ci-status'
import { Dispatcher } from '../../../src/ui/dispatcher'
import { renderComponent } from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

function createRepository() {
  return new GitHubRepository(
    'desktop',
    new Owner('desktop', 'https://api.github.com', 1),
    1
  )
}

function createCombinedCheck(
  conclusion: APICheckConclusion | null
): ICombinedRefCheck {
  return {
    status:
      conclusion === null
        ? APICheckStatus.InProgress
        : APICheckStatus.Completed,
    conclusion,
    checks: [
      {
        id: 1,
        name: 'build',
        description: 'status',
        status:
          conclusion === null
            ? APICheckStatus.InProgress
            : APICheckStatus.Completed,
        conclusion,
        appName: 'GitHub Actions',
        htmlUrl: null,
        checkSuiteId: null,
      },
    ],
  }
}

function createDispatcher(initialCheck: ICombinedRefCheck | null) {
  const callbacks = new Map<string, (check: ICombinedRefCheck | null) => void>()
  const tryGetRefs = new Array<string>()
  const subscribeRefs = new Array<string>()
  const disposedRefs = new Array<string>()

  const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher

  Object.assign(dispatcher, {
    tryGetCommitStatus: (_repository: GitHubRepository, ref: string) => {
      tryGetRefs.push(ref)
      return initialCheck
    },
    subscribeToCommitStatus: (
      _repository: GitHubRepository,
      ref: string,
      callback: (check: ICombinedRefCheck | null) => void
    ) => {
      subscribeRefs.push(ref)
      callbacks.set(ref, callback)

      return {
        dispose() {
          disposedRefs.push(ref)
          callbacks.delete(ref)
        },
      }
    },
  })

  return {
    dispatcher,
    tryGetRefs,
    subscribeRefs,
    disposedRefs,
    emit(ref: string, check: ICombinedRefCheck | null) {
      callbacks.get(ref)?.(check)
    },
  }
}

describe('CIStatus', () => {
  it('renders nothing for a missing check and cleans up its subscription', () => {
    const observed = new Array<ICombinedRefCheck | null>()
    const dispatcher = createDispatcher(null)
    const ref = 'refs/pull/42/head'

    const { container, unmount: u } = renderComponent(
      <CIStatus
        dispatcher={dispatcher.dispatcher}
        repository={createRepository()}
        commitRef={ref}
        onCheckChange={check => observed.push(check)}
      />
    )
    unmount = u

    assert.equal(container.innerHTML, '')
    assert.deepEqual(dispatcher.tryGetRefs, [ref])
    assert.deepEqual(dispatcher.subscribeRefs, [ref])
    assert.deepEqual(observed, [null])

    u()
    unmount = undefined

    assert.deepEqual(dispatcher.disposedRefs, [ref])
  })

  it('renders the current check state with the appropriate status class', () => {
    const dispatcher = createDispatcher(
      createCombinedCheck(APICheckConclusion.Success)
    )

    const { container, unmount: u } = renderComponent(
      <CIStatus
        dispatcher={dispatcher.dispatcher}
        repository={createRepository()}
        commitRef="refs/pull/7/head"
        className="extra-class"
      />
    )
    unmount = u

    const icon = container.querySelector(
      'svg.ci-status.ci-status-success.extra-class'
    )
    assert.ok(icon)
  })

  it('updates its rendered status when the subscription callback fires', () => {
    const ref = 'refs/pull/8/head'
    const observed = new Array<ICombinedRefCheck | null>()
    const dispatcher = createDispatcher(null)

    const { container, unmount: u } = renderComponent(
      <CIStatus
        dispatcher={dispatcher.dispatcher}
        repository={createRepository()}
        commitRef={ref}
        onCheckChange={check => observed.push(check)}
      />
    )
    unmount = u

    act(() => {
      dispatcher.emit(ref, createCombinedCheck(APICheckConclusion.Failure))
    })

    assert.ok(container.querySelector('svg.ci-status.ci-status-failure'))
    assert.equal(observed.length, 2)
    assert.equal(observed[1]?.conclusion, APICheckConclusion.Failure)
  })
})
