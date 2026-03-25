import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { DiffOptions } from '../../../src/ui/diff/diff-options'
import {
  checkboxWithLabel,
  click,
  queryByTextOrThrow,
  queryOrThrow,
  radioButtonWithLabel,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})

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
    queryByTextOrThrow(
      container,
      'h3',
      __DARWIN__ ? 'Diff Settings' : 'Diff Options'
    )
    assert.equal(calls.opened, 1)

    click(button)

    assert.equal(button.getAttribute('aria-expanded'), 'false')
  })

  it('toggles hide whitespace and renders the interactive diff warning', () => {
    const { container, unmount: u, calls } = renderDiffOptions()
    unmount = u

    click(queryOrThrow(container, '.diff-options-component button'))

    queryByTextOrThrow(
      container,
      '.secondary-text',
      'Interacting with individual lines or hunks will be disabled while hiding whitespace.'
    )

    const checkbox = checkboxWithLabel(
      container,
      __DARWIN__ ? 'Hide Whitespace Changes' : 'Hide whitespace changes'
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

    assert.equal(container.querySelector('.secondary-text'), null)

    click(radioButtonWithLabel(container, 'Unified'))

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

    click(radioButtonWithLabel(container, 'Split'))

    assert.deepEqual(calls.split, [true])

    click(queryOrThrow(container, '.diff-options-component button'))
  })
})
