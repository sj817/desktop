import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  buttonWithText,
  click,
  renderComponent,
} from '../../helpers/component-test-utils'
import { OkCancelButtonGroup } from '../../../src/ui/dialog/ok-cancel-button-group'

let unmount: () => void

afterEach(() => unmount?.())

describe('OkCancelButtonGroup', () => {
  it('renders Ok and Cancel buttons', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup />
      </form>
    )
    unmount = u

    const buttons = container.querySelectorAll('button')
    assert.equal(buttons.length, 2)
    assert.ok(buttonWithText(container, 'Ok'))
    assert.ok(buttonWithText(container, 'Cancel'))
  })

  it('uses custom Ok button text', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup okButtonText="Save" />
      </form>
    )
    unmount = u

    assert.ok(buttonWithText(container, 'Save'))
  })

  it('uses custom Cancel button text', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup cancelButtonText="Dismiss" />
      </form>
    )
    unmount = u

    assert.ok(buttonWithText(container, 'Dismiss'))
  })

  it('calls onOkButtonClick when Ok is clicked', () => {
    let okClicked = false
    const handleOk = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      okClicked = true
    }
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup onOkButtonClick={handleOk} />
      </form>
    )
    unmount = u

    click(buttonWithText(container, 'Ok'))
    assert.equal(okClicked, true)
  })

  it('calls onCancelButtonClick when Cancel is clicked', () => {
    let cancelClicked = false
    const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      cancelClicked = true
    }
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup onCancelButtonClick={handleCancel} />
      </form>
    )
    unmount = u

    click(buttonWithText(container, 'Cancel'))
    assert.equal(cancelClicked, true)
  })

  it('disables Ok button when okButtonDisabled is true', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup okButtonDisabled={true} />
      </form>
    )
    unmount = u

    const okButton = buttonWithText(container, 'Ok')
    assert.equal(okButton.getAttribute('aria-disabled'), 'true')
  })

  it('hides Cancel button when cancelButtonVisible is false', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup cancelButtonVisible={false} />
      </form>
    )
    unmount = u

    const buttons = container.querySelectorAll('button')
    assert.equal(buttons.length, 1)
    assert.equal(buttonWithText(container, 'Ok').textContent, 'Ok')
  })

  it('has the button-group class', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup />
      </form>
    )
    unmount = u

    const group = container.querySelector('.button-group')
    assert.ok(group)
  })

  it('adds destructive class when destructive is true', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup destructive={true} />
      </form>
    )
    unmount = u

    const group = container.querySelector('.button-group.destructive')
    assert.ok(group)
  })
})
