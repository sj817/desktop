import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import { DiffSearchInput } from '../../../src/ui/diff/diff-search-input'
import {
  keyDown,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set?.call(input, value)
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

describe('DiffSearchInput', () => {
  it('renders the search input and clear button state', () => {
    const { container, unmount: u } = renderComponent(
      <DiffSearchInput onSearch={() => {}} onClose={() => {}} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.placeholder, 'Search…')
    assert.equal(container.querySelector('.clear-button'), null)

    setInputValue(input, 'bundle')

    assert.equal(input.value, 'bundle')
    assert.ok(container.querySelector('.clear-button'))
  })

  it('searches forward when Enter is pressed', () => {
    const searches = new Array<{
      query: string
      direction: 'next' | 'previous'
    }>()

    const { container, unmount: u } = renderComponent(
      <DiffSearchInput
        onSearch={(query, direction) => {
          searches.push({ query, direction })
        }}
        onClose={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    setInputValue(input, 'README')
    keyDown(input, 'Enter')

    assert.deepEqual(searches, [{ query: 'README', direction: 'next' }])
  })

  it('searches backward when Shift+Enter is pressed', () => {
    const searches = new Array<{
      query: string
      direction: 'next' | 'previous'
    }>()

    const { container, unmount: u } = renderComponent(
      <DiffSearchInput
        onSearch={(query, direction) => {
          searches.push({ query, direction })
        }}
        onClose={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    setInputValue(input, 'README')
    keyDown(input, 'Enter', { shiftKey: true })

    assert.deepEqual(searches, [{ query: 'README', direction: 'previous' }])
  })

  it('closes on Escape and blur', () => {
    const events = new Array<string>()

    const { container, unmount: u } = renderComponent(
      <DiffSearchInput
        onSearch={() => {
          throw new Error('should not be called')
        }}
        onClose={() => {
          events.push('close')
        }}
      />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')

    keyDown(input, 'Escape')
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }))

    assert.deepEqual(events, ['close', 'close'])
  })
})
