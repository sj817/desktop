import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import {
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import {
  CommitWarning,
  CommitWarningIcon,
} from '../../../src/ui/changes/commit-warning'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

describe('CommitWarning', () => {
  it('renders the warning message content', () => {
    const { container, unmount: u } = renderComponent(
      <CommitWarning icon={CommitWarningIcon.Warning}>
        Review your commit message
      </CommitWarning>
    )
    unmount = u

    const message = queryOrThrow(container, '.warning-message')
    assert.equal(message.textContent, 'Review your commit message')
  })

  it('renders the expected icon class for each warning type', () => {
    const warning = renderComponent(
      <CommitWarning icon={CommitWarningIcon.Warning}>Warning</CommitWarning>
    )
    const information = renderComponent(
      <CommitWarning icon={CommitWarningIcon.Information}>
        Information
      </CommitWarning>
    )
    const error = renderComponent(
      <CommitWarning icon={CommitWarningIcon.Error}>Error</CommitWarning>
    )

    unmount = () => {
      warning.unmount()
      information.unmount()
      error.unmount()
    }

    assert.ok(
      queryOrThrow<SVGElement>(
        warning.container,
        '.warning-icon-container svg'
      ).classList.contains('warning-icon')
    )
    assert.ok(
      queryOrThrow<SVGElement>(
        information.container,
        '.warning-icon-container svg'
      ).classList.contains('information-icon')
    )
    assert.ok(
      queryOrThrow<SVGElement>(
        error.container,
        '.warning-icon-container svg'
      ).classList.contains('error-icon')
    )
  })

  it('suppresses the context menu on the root element', () => {
    const { container, unmount: u } = renderComponent(
      <CommitWarning icon={CommitWarningIcon.Warning}>Blocked</CommitWarning>
    )
    unmount = u

    const root = queryOrThrow<HTMLDivElement>(
      container,
      '.commit-warning-component'
    )

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    })

    let dispatchResult = true
    act(() => {
      dispatchResult = root.dispatchEvent(event)
    })

    assert.equal(dispatchResult, false)
    assert.equal(event.defaultPrevented, true)
  })
})
