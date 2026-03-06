import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  renderComponent,
  click,
  queryOrThrow,
} from '../../helpers/component-test-utils'
import { RadioButton } from '../../../src/ui/lib/radio-button'

let unmount: () => void

afterEach(() => unmount?.())

describe('RadioButton', () => {
  it('renders a radio input', () => {
    const noop = () => {}
    const { container, unmount: u } = renderComponent(
      <RadioButton value="option1" checked={false} onSelected={noop} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="radio"]'
    )
    assert.equal(input.type, 'radio')
  })

  it('renders as checked when checked prop is true', () => {
    const noop = () => {}
    const { container, unmount: u } = renderComponent(
      <RadioButton value="option1" checked={true} onSelected={noop} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="radio"]'
    )
    assert.equal(input.checked, true)
  })

  it('renders as unchecked when checked prop is false', () => {
    const noop = () => {}
    const { container, unmount: u } = renderComponent(
      <RadioButton value="option1" checked={false} onSelected={noop} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="radio"]'
    )
    assert.equal(input.checked, false)
  })

  it('renders with a string label', () => {
    const noop = () => {}
    const { container, unmount: u } = renderComponent(
      <RadioButton
        value="option1"
        checked={false}
        onSelected={noop}
        label="Option One"
      />
    )
    unmount = u

    const label = container.querySelector('label')
    assert.ok(label)
    assert.ok(label!.textContent?.includes('Option One'))
  })

  it('calls onSelected when clicked', () => {
    let selectedValue: string | null = null
    const handleSelected = (value: string) => {
      selectedValue = value
    }
    const { container, unmount: u } = renderComponent(
      <RadioButton value="myval" checked={false} onSelected={handleSelected} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="radio"]'
    )
    click(input)
    assert.equal(selectedValue, 'myval')
  })

  it('has the radio-button-component class', () => {
    const noop = () => {}
    const { container, unmount: u } = renderComponent(
      <RadioButton value="option1" checked={false} onSelected={noop} />
    )
    unmount = u

    const wrapper = container.querySelector('.radio-button-component')
    assert.ok(wrapper)
  })

  it('renders children as label when no label prop', () => {
    const noop = () => {}
    const { container, unmount: u } = renderComponent(
      <RadioButton value="option1" checked={false} onSelected={noop}>
        Child label text
      </RadioButton>
    )
    unmount = u

    const label = container.querySelector('label')
    assert.ok(label)
    assert.ok(label!.textContent?.includes('Child label text'))
  })
})
