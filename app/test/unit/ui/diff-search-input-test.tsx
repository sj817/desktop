import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { DiffSearchInput } from '../../../src/ui/diff/diff-search-input'
import {
  blur,
  change,
  keyDown,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})

describe('DiffSearchInput', () => {
  it('renders the search input and clear button state', () => {
    const { container, unmount: u } = renderComponent(
      <DiffSearchInput onSearch={() => {}} onClose={() => {}} />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(container, 'input')
    assert.equal(input.placeholder, 'Search…')
    assert.equal(container.querySelector('.clear-button'), null)

    change(input, 'bundle')

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
    change(input, 'README')
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
    change(input, 'README')
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
    blur(input)

    assert.deepEqual(events, ['close', 'close'])
  })
})
