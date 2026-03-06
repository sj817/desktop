import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  renderComponent,
  click,
  queryOrThrow,
} from '../../helpers/component-test-utils'
import { LinkButton } from '../../../src/ui/lib/link-button'

let unmount: () => void

afterEach(() => unmount?.())

describe('LinkButton', () => {
  it('renders an anchor element', () => {
    const { container, unmount: u } = renderComponent(
      <LinkButton>Click here</LinkButton>
    )
    unmount = u

    const anchor = queryOrThrow<HTMLAnchorElement>(container, 'a')
    assert.equal(anchor.textContent, 'Click here')
  })

  it('renders with the given URI as href', () => {
    const { container, unmount: u } = renderComponent(
      <LinkButton uri="https://github.com">GitHub</LinkButton>
    )
    unmount = u

    const anchor = queryOrThrow<HTMLAnchorElement>(container, 'a')
    assert.equal(anchor.href, 'https://github.com/')
  })

  it('renders with empty href when no URI provided', () => {
    const { container, unmount: u } = renderComponent(
      <LinkButton>No link</LinkButton>
    )
    unmount = u

    const anchor = queryOrThrow<HTMLAnchorElement>(container, 'a')
    assert.equal(anchor.getAttribute('href'), '')
  })

  it('calls onClick when clicked', () => {
    let clicked = false
    const handleClick = () => {
      clicked = true
    }
    const { container, unmount: u } = renderComponent(
      <LinkButton onClick={handleClick}>Press</LinkButton>
    )
    unmount = u

    click(queryOrThrow(container, 'a'))
    assert.equal(clicked, true)
  })

  it('does not call onClick when disabled', () => {
    let clicked = false
    const handleClick = () => {
      clicked = true
    }
    const { container, unmount: u } = renderComponent(
      <LinkButton disabled={true} onClick={handleClick}>
        Disabled
      </LinkButton>
    )
    unmount = u

    click(queryOrThrow(container, 'a'))
    assert.equal(clicked, false)
  })

  it('has the link-button-component class', () => {
    const { container, unmount: u } = renderComponent(
      <LinkButton>Styled</LinkButton>
    )
    unmount = u

    const anchor = queryOrThrow<HTMLAnchorElement>(container, 'a')
    assert.ok(anchor.classList.contains('link-button-component'))
  })

  it('applies custom className', () => {
    const { container, unmount: u } = renderComponent(
      <LinkButton className="my-link">Custom</LinkButton>
    )
    unmount = u

    const anchor = queryOrThrow<HTMLAnchorElement>(container, 'a')
    assert.ok(anchor.classList.contains('my-link'))
  })

  it('sets role="button" when no URI is provided', () => {
    const { container, unmount: u } = renderComponent(
      <LinkButton>Button-like</LinkButton>
    )
    unmount = u

    const anchor = queryOrThrow<HTMLAnchorElement>(container, 'a')
    assert.equal(anchor.getAttribute('role'), 'button')
  })

  it('does not set role when URI is provided', () => {
    const { container, unmount: u } = renderComponent(
      <LinkButton uri="https://example.com">Link</LinkButton>
    )
    unmount = u

    const anchor = queryOrThrow<HTMLAnchorElement>(container, 'a')
    assert.equal(anchor.getAttribute('role'), null)
  })

  it('sets aria-label when provided', () => {
    const { container, unmount: u } = renderComponent(
      <LinkButton ariaLabel="Open settings">Settings</LinkButton>
    )
    unmount = u

    const anchor = queryOrThrow<HTMLAnchorElement>(container, 'a')
    assert.equal(anchor.getAttribute('aria-label'), 'Open settings')
  })
})
