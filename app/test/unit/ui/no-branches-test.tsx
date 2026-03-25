import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import {
  click,
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { NoBranches } from '../../../src/ui/branches/no-branches'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

describe('NoBranches', () => {
  it('renders the create branch call to action when branch creation is allowed', () => {
    let invoked = false

    const { container, unmount: u } = renderComponent(
      <NoBranches
        canCreateNewBranch={true}
        onCreateNewBranch={() => {
          invoked = true
        }}
      />
    )
    unmount = u

    queryByTextOrThrow(container, '.title', "Sorry, I can't find that branch")
    queryByTextOrThrow(
      container,
      '.subtitle',
      'Do you want to create a new branch instead?'
    )
    queryByTextOrThrow(
      container,
      '.create-branch-button',
      __DARWIN__ ? 'Create New Branch' : 'Create new branch'
    )

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      '.create-branch-button'
    )
    click(button)

    assert.equal(invoked, true)
  })

  it('renders the keyboard shortcut hint when branch creation is allowed', () => {
    const { container, unmount: u } = renderComponent(
      <NoBranches
        canCreateNewBranch={true}
        onCreateNewBranch={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const shortcuts = Array.from(container.querySelectorAll('kbd')).map(k =>
      k.textContent?.trim()
    )

    if (__DARWIN__) {
      assert.deepEqual(shortcuts, ['⌘', '⇧', 'N'])
    } else {
      assert.deepEqual(shortcuts, ['Ctrl', 'Shift', 'N'])
    }
  })

  it('renders a custom no-branches message when branch creation is unavailable', () => {
    const { container, unmount: u } = renderComponent(
      <NoBranches
        canCreateNewBranch={false}
        noBranchesMessage="No matching branches found"
        onCreateNewBranch={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    queryByTextOrThrow(container, '.no-branches', 'No matching branches found')
    assert.equal(container.querySelector('.create-branch-button'), null)
  })
})
