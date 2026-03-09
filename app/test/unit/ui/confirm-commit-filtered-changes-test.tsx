import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import { ConfirmCommitFilteredChanges } from '../../../src/ui/changes/confirm-commit-filtered-changes-dialog'
import {
  click,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})

describe('ConfirmCommitFilteredChanges', () => {
  it('submits with confirmation enabled by default', () => {
    let committed = 0
    let dismissed = 0
    const confirmationValues = new Array<boolean>()

    const { container, unmount: u } = renderComponent(
      <ConfirmCommitFilteredChanges
        onCommitAnyway={() => {
          committed += 1
        }}
        onDismissed={() => {
          dismissed += 1
        }}
        showFilesToBeCommitted={() => {
          throw new Error('should not be called')
        }}
        setConfirmCommitFilteredChanges={value => {
          confirmationValues.push(value)
        }}
      />
    )
    unmount = u

    const form = queryOrThrow<HTMLFormElement>(container, 'form')
    act(() => {
      form.dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
    })

    assert.deepEqual(confirmationValues, [true])
    assert.equal(committed, 1)
    assert.equal(dismissed, 1)
  })

  it('updates the saved confirmation preference when the checkbox is toggled off', () => {
    const confirmationValues = new Array<boolean>()

    const { container, unmount: u } = renderComponent(
      <ConfirmCommitFilteredChanges
        onCommitAnyway={() => {
          // exercised through the submit path below
        }}
        onDismissed={() => {
          // exercised through the submit path below
        }}
        showFilesToBeCommitted={() => {
          throw new Error('should not be called')
        }}
        setConfirmCommitFilteredChanges={value => {
          confirmationValues.push(value)
        }}
      />
    )
    unmount = u

    const checkbox = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )
    click(checkbox)

    const form = queryOrThrow<HTMLFormElement>(container, 'form')
    act(() => {
      form.dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
    })

    assert.deepEqual(confirmationValues, [false])
  })

  it('shows the files to be committed and dismisses the dialog when the hidden changes link is clicked', () => {
    let shown = 0
    let dismissed = 0

    const { container, unmount: u } = renderComponent(
      <ConfirmCommitFilteredChanges
        onCommitAnyway={() => {
          throw new Error('should not be called')
        }}
        onDismissed={() => {
          dismissed += 1
        }}
        showFilesToBeCommitted={() => {
          shown += 1
        }}
        setConfirmCommitFilteredChanges={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    click(queryOrThrow(container, 'a.link-button-component'))

    assert.equal(shown, 1)
    assert.equal(dismissed, 1)
  })
})