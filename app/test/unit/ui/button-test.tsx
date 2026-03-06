import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  renderComponent,
  click,
  queryOrThrow,
} from '../../helpers/component-test-utils'
import { Button } from '../../../src/ui/lib/button'

let unmount: () => void

afterEach(() => unmount?.())

describe('Button', () => {
  it('renders a button element', () => {
    const { container, unmount: u } = renderComponent(<Button>Click me</Button>)
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(container, 'button')
    assert.equal(button.textContent, 'Click me')
  })

  it('calls onClick when clicked', () => {
    let clicked = false
    const handleClick = () => {
      clicked = true
    }
    const { container, unmount: u } = renderComponent(
      <Button onClick={handleClick}>Press</Button>
    )
    unmount = u

    click(queryOrThrow(container, 'button'))
    assert.equal(clicked, true)
  })

  it('does not call onClick when disabled', () => {
    let clicked = false
    const handleClick = () => {
      clicked = true
    }
    const { container, unmount: u } = renderComponent(
      <Button disabled={true} onClick={handleClick}>
        Press
      </Button>
    )
    unmount = u

    click(queryOrThrow(container, 'button'))
    assert.equal(clicked, false)
  })

  it('defaults to type="button"', () => {
    const { container, unmount: u } = renderComponent(<Button>Test</Button>)
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(container, 'button')
    assert.equal(button.type, 'button')
  })

  it('renders with type="submit" when specified', () => {
    const { container, unmount: u } = renderComponent(
      <Button type="submit">Submit</Button>
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(container, 'button')
    assert.equal(button.type, 'submit')
  })

  it('sets aria-disabled when disabled', () => {
    const { container, unmount: u } = renderComponent(
      <Button disabled={true}>Disabled</Button>
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(container, 'button')
    assert.equal(button.getAttribute('aria-disabled'), 'true')
  })

  it('has the button-component class', () => {
    const { container, unmount: u } = renderComponent(<Button>Styled</Button>)
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(container, 'button')
    assert.ok(button.classList.contains('button-component'))
  })

  it('applies custom className', () => {
    const { container, unmount: u } = renderComponent(
      <Button className="custom-class">Test</Button>
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(container, 'button')
    assert.ok(button.classList.contains('custom-class'))
  })
})
