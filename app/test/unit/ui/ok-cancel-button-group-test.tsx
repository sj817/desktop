import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { renderComponent, click } from '../../helpers/component-test-utils'
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

    const texts = Array.from(buttons).map(b => b.textContent)
    assert.ok(texts.includes('Ok'))
    assert.ok(texts.includes('Cancel'))
  })

  it('uses custom Ok button text', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup okButtonText="Save" />
      </form>
    )
    unmount = u

    const buttons = container.querySelectorAll('button')
    const texts = Array.from(buttons).map(b => b.textContent)
    assert.ok(texts.includes('Save'))
  })

  it('uses custom Cancel button text', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup cancelButtonText="Dismiss" />
      </form>
    )
    unmount = u

    const buttons = container.querySelectorAll('button')
    const texts = Array.from(buttons).map(b => b.textContent)
    assert.ok(texts.includes('Dismiss'))
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

    const buttons = container.querySelectorAll('button')
    const okButton = Array.from(buttons).find(b => b.textContent === 'Ok')!
    click(okButton)
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

    const buttons = container.querySelectorAll('button')
    const cancelButton = Array.from(buttons).find(
      b => b.textContent === 'Cancel'
    )!
    click(cancelButton)
    assert.equal(cancelClicked, true)
  })

  it('disables Ok button when okButtonDisabled is true', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <OkCancelButtonGroup okButtonDisabled={true} />
      </form>
    )
    unmount = u

    const buttons = container.querySelectorAll('button')
    const okButton = Array.from(buttons).find(b => b.textContent === 'Ok')!
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
    assert.equal(buttons[0].textContent, 'Ok')
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
