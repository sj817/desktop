import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  click,
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { DialogHeader } from '../../../src/ui/dialog/header'

let unmount: () => void

afterEach(() => unmount?.())

describe('DialogHeader', () => {
  it('renders the title text', () => {
    const { container, unmount: u } = renderComponent(
      <DialogHeader title="My Dialog" titleId="dialog-title" />
    )
    unmount = u

    queryByTextOrThrow(container, 'h1', 'My Dialog')
  })

  it('sets the title id', () => {
    const { container, unmount: u } = renderComponent(
      <DialogHeader title="Test" titleId="test-title-id" />
    )
    unmount = u

    const heading = queryByTextOrThrow<HTMLHeadingElement>(container, 'h1', 'Test')
    assert.equal(heading.id, 'test-title-id')
  })

  it('renders a JSX title', () => {
    const title = <span className="custom-title">Custom</span>
    const { container, unmount: u } = renderComponent(
      <DialogHeader title={title} titleId="jsx-title" />
    )
    unmount = u

    queryByTextOrThrow(container, '.custom-title', 'Custom')
  })

  it('renders a close button when showCloseButton is true', () => {
    let closeClicks = 0
    const { container, unmount: u } = renderComponent(
      <DialogHeader
        title="Test"
        titleId="close-btn-test"
        showCloseButton={true}
        onCloseButtonClick={() => {
          closeClicks += 1
        }}
      />
    )
    unmount = u

    const closeButton = queryOrThrow<HTMLButtonElement>(container, 'button.close')
    assert.equal(closeButton.getAttribute('aria-label'), 'Close')

    click(closeButton)

    assert.equal(closeClicks, 1)
  })

  it('renders a close button by default', () => {
    const { container, unmount: u } = renderComponent(
      <DialogHeader title="Test" titleId="no-close-btn" />
    )
    unmount = u

    queryByTextOrThrow(container, 'h1', 'Test')
    assert.equal(
      queryOrThrow<HTMLButtonElement>(container, 'button.close').getAttribute(
        'aria-label'
      ),
      'Close'
    )
  })
})
