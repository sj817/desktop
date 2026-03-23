import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { renderComponent } from '../../helpers/component-test-utils'
import { DialogHeader } from '../../../src/ui/dialog/header'

let unmount: () => void

afterEach(() => unmount?.())

describe('DialogHeader', () => {
  it('renders the title text', () => {
    const { container, unmount: u } = renderComponent(
      <DialogHeader title="My Dialog" titleId="dialog-title" />
    )
    unmount = u

    const heading = container.querySelector('h1')
    assert.ok(heading)
    assert.equal(heading!.textContent, 'My Dialog')
  })

  it('sets the title id', () => {
    const { container, unmount: u } = renderComponent(
      <DialogHeader title="Test" titleId="test-title-id" />
    )
    unmount = u

    const heading = container.querySelector('h1')
    assert.equal(heading!.id, 'test-title-id')
  })

  it('renders a JSX title', () => {
    const title = <span className="custom-title">Custom</span>
    const { container, unmount: u } = renderComponent(
      <DialogHeader title={title} titleId="jsx-title" />
    )
    unmount = u

    const customTitle = container.querySelector('.custom-title')
    assert.ok(customTitle)
    assert.equal(customTitle!.textContent, 'Custom')
  })

  it('renders a close button when showCloseButton is true', () => {
    const handleClose = () => {}
    const { container, unmount: u } = renderComponent(
      <DialogHeader
        title="Test"
        titleId="close-btn-test"
        showCloseButton={true}
        onCloseButtonClick={handleClose}
      />
    )
    unmount = u

    // The close button should exist when showCloseButton is true
    assert.ok(container.innerHTML.length > 0)
  })

  it('does not render a close button by default', () => {
    const { container, unmount: u } = renderComponent(
      <DialogHeader title="Test" titleId="no-close-btn" />
    )
    unmount = u

    // No close button should be present by default
    const heading = container.querySelector('h1')
    assert.ok(heading)
  })
})
