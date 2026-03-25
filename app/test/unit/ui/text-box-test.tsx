import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  queryByTextOrThrow,
  renderComponent,
  queryOrThrow,
} from '../../helpers/component-test-utils'
import { TextBox } from '../../../src/ui/lib/text-box'

let unmount: () => void

afterEach(() => unmount?.())

describe('TextBox', () => {
  it('renders an input element', () => {
    const { container, unmount: u } = renderComponent(<TextBox />)
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.type, 'text')
  })

  it('renders with the given value', () => {
    const { container, unmount: u } = renderComponent(<TextBox value="hello" />)
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.value, 'hello')
  })

  it('renders a label when provided', () => {
    const { container, unmount: u } = renderComponent(
      <TextBox label="Username" />
    )
    unmount = u

    queryByTextOrThrow(container, 'label', 'Username')
  })

  it('renders with placeholder text', () => {
    const { container, unmount: u } = renderComponent(
      <TextBox placeholder="Type here..." />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.placeholder, 'Type here...')
  })

  it('renders as disabled when disabled prop is true', () => {
    const { container, unmount: u } = renderComponent(
      <TextBox disabled={true} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.disabled, true)
  })

  it('renders as read-only when readOnly prop is true', () => {
    const { container, unmount: u } = renderComponent(
      <TextBox readOnly={true} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.readOnly, true)
  })

  it('accepts onValueChanged callback prop', () => {
    const handleChange = () => {}
    const { container, unmount: u } = renderComponent(
      <TextBox value="test" onValueChanged={handleChange} />
    )
    unmount = u

    // Verify the component rendered with the callback wired up
    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.value, 'test')
  })

  it('renders with type="search" when specified', () => {
    const { container, unmount: u } = renderComponent(<TextBox type="search" />)
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.type, 'search')
  })

  it('renders a clear button when displayClearButton is true and value is non-empty', () => {
    const { container, unmount: u } = renderComponent(
      <TextBox value="something" displayClearButton={true} />
    )
    unmount = u

    const clearButton = container.querySelector('button.clear-button')
    assert.ok(clearButton, 'Expected a clear button to be rendered')
  })

  it('does not render a clear button when value is empty', () => {
    const { container, unmount: u } = renderComponent(
      <TextBox value="" displayClearButton={true} />
    )
    unmount = u

    const clearButton = container.querySelector('button.clear-button')
    assert.equal(clearButton, null)
  })

  it('has the text-box-component class', () => {
    const { container, unmount: u } = renderComponent(<TextBox />)
    unmount = u

    const wrapper = container.querySelector('.text-box-component')
    assert.ok(wrapper)
  })

  it('applies custom className', () => {
    const { container, unmount: u } = renderComponent(
      <TextBox className="custom-input" />
    )
    unmount = u

    const wrapper = container.querySelector('.text-box-component.custom-input')
    assert.ok(wrapper)
  })
})
