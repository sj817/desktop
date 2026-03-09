import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import { DiffOptions } from '../../../src/ui/diff/diff-options'
import {
  click,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})
function setChecked(input: HTMLInputElement, checked: boolean) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'checked'
    )?.set?.call(input, checked)
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

function renderDiffOptions(
  props: Partial<React.ComponentProps<typeof DiffOptions>> = {}
) {
  const calls = {
    opened: 0,
    whitespace: new Array<boolean>(),
    split: new Array<boolean>(),
  }

  const rendered = renderComponent(
    <DiffOptions
      isInteractiveDiff={true}
      hideWhitespaceChanges={false}
      onHideWhitespaceChangesChanged={value => {
        calls.whitespace.push(value)
      }}
      showSideBySideDiff={false}
      onShowSideBySideDiffChanged={value => {
        calls.split.push(value)
      }}
      onDiffOptionsOpened={() => {
        calls.opened += 1
      }}
      {...props}
    />
  )

  return {
    ...rendered,
    calls,
  }
}

describe('DiffOptions', () => {
  it('opens and closes the popover from the toolbar button', () => {
    const { container, unmount: u, calls } = renderDiffOptions()
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      '.diff-options-component button'
    )

    assert.equal(button.getAttribute('aria-expanded'), 'false')

    click(button)

    assert.equal(button.getAttribute('aria-expanded'), 'true')
    assert.ok(
      container.textContent?.includes(
        __DARWIN__ ? 'Diff Settings' : 'Diff Options'
      )
    )
    assert.equal(calls.opened, 1)

    click(button)

    assert.equal(button.getAttribute('aria-expanded'), 'false')
  })

  it('toggles hide whitespace and renders the interactive diff warning', () => {
    const { container, unmount: u, calls } = renderDiffOptions()
    unmount = u

    click(queryOrThrow(container, '.diff-options-component button'))

    assert.ok(
      container.textContent?.includes(
        'Interacting with individual lines or hunks will be disabled while hiding whitespace.'
      )
    )

    const checkbox = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )

    click(checkbox)

    assert.deepEqual(calls.whitespace, [true])

    click(queryOrThrow(container, '.diff-options-component button'))
  })

  it('switches from split to unified diff display mode', () => {
    const {
      container,
      unmount: u,
      calls,
    } = renderDiffOptions({
      showSideBySideDiff: true,
      isInteractiveDiff: false,
    })
    unmount = u

    click(queryOrThrow(container, '.diff-options-component button'))

    assert.equal(
      container.textContent?.includes(
        'Interacting with individual lines or hunks will be disabled while hiding whitespace.'
      ),
      false
    )

    const radios = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    )
    const unifiedRadio = radios.find(radio => radio.value === 'Unified')
    const splitRadio = radios.find(radio => radio.value === 'Split')

    assert.ok(unifiedRadio)
    assert.ok(splitRadio)

    click(unifiedRadio!)

    assert.deepEqual(calls.split, [false])

    click(queryOrThrow(container, '.diff-options-component button'))
  })

  it('switches from unified to split diff display mode', () => {
    const {
      container,
      unmount: u,
      calls,
    } = renderDiffOptions({
      showSideBySideDiff: false,
      isInteractiveDiff: false,
    })
    unmount = u

    click(queryOrThrow(container, '.diff-options-component button'))

    const splitRadio = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    ).find(radio => radio.value === 'Split')

    assert.ok(splitRadio)

    click(splitRadio!)

    assert.deepEqual(calls.split, [true])

    click(queryOrThrow(container, '.diff-options-component button'))
  })
})
