import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  queryByTextOrThrow,
  renderComponent,
  click,
  queryOrThrow,
} from '../../helpers/component-test-utils'
import { Checkbox, CheckboxValue } from '../../../src/ui/lib/checkbox'

let unmount: () => void

afterEach(() => unmount?.())

describe('Checkbox', () => {
  it('renders an unchecked checkbox', () => {
    const { container, unmount: u } = renderComponent(
      <Checkbox value={CheckboxValue.Off} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )
    assert.equal(input.checked, false)
    assert.equal(input.indeterminate, false)
  })

  it('renders a checked checkbox', () => {
    const { container, unmount: u } = renderComponent(
      <Checkbox value={CheckboxValue.On} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )
    assert.equal(input.checked, true)
  })

  it('renders an indeterminate (mixed) checkbox', () => {
    const { container, unmount: u } = renderComponent(
      <Checkbox value={CheckboxValue.Mixed} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )
    assert.equal(input.indeterminate, true)
  })

  it('renders a label when provided', () => {
    const { container, unmount: u } = renderComponent(
      <Checkbox value={CheckboxValue.Off} label="Accept terms" />
    )
    unmount = u

    queryByTextOrThrow(container, 'label', 'Accept terms')
  })

  it('does not render a label when omitted', () => {
    const { container, unmount: u } = renderComponent(
      <Checkbox value={CheckboxValue.Off} />
    )
    unmount = u

    const label = container.querySelector('label')
    assert.equal(label, null)
  })

  it('calls onChange when clicked', () => {
    let changed = false
    const handleChange = () => {
      changed = true
    }
    const { container, unmount: u } = renderComponent(
      <Checkbox value={CheckboxValue.Off} onChange={handleChange} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )
    click(input)
    assert.equal(changed, true)
  })

  it('renders as disabled when disabled prop is true', () => {
    const { container, unmount: u } = renderComponent(
      <Checkbox value={CheckboxValue.Off} disabled={true} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )
    assert.equal(input.disabled, true)
  })

  it('has the checkbox-component class', () => {
    const { container, unmount: u } = renderComponent(
      <Checkbox value={CheckboxValue.Off} />
    )
    unmount = u

    const wrapper = container.querySelector('.checkbox-component')
    assert.ok(wrapper)
  })
})
