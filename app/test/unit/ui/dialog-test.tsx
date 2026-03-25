import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  queryByTextOrThrow,
  keyDown,
  queryOrThrow,
  renderComponent,
  submit,
  waitForDuration,
} from '../../helpers/component-test-utils'
import {
  Dialog,
  DialogPreferredFocusClassName,
  DialogStackContext,
} from '../../../src/ui/dialog/dialog'

type DialogElement = HTMLElement & {
  open?: boolean
  showModal?: () => void
  close?: () => void
}

class TestResizeObserver {
  public observe() {}
  public disconnect() {}
}

const dialogPrototype = HTMLElement.prototype as DialogElement

if (globalThis.ResizeObserver === undefined) {
  Object.assign(globalThis, { ResizeObserver: TestResizeObserver })
}

if (typeof dialogPrototype.showModal !== 'function') {
  dialogPrototype.showModal = function () {
    this.open = true
    this.setAttribute('open', '')
  }
}

if (typeof dialogPrototype.close !== 'function') {
  dialogPrototype.close = function () {
    this.open = false
    this.removeAttribute('open')
  }
}

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
  document.body.innerHTML = ''
})

function renderDialog(
  element: React.ReactElement,
  isTopMost = false
): HTMLElement {
  const rendered = renderComponent(
    <DialogStackContext.Provider value={{ isTopMost }}>
      {element}
    </DialogStackContext.Provider>
  )

  unmount = rendered.unmount
  return queryOrThrow<HTMLElement>(rendered.container, 'dialog')
}

describe('Dialog', () => {
  it('renders header, children, and dialog metadata', () => {
    const dialog = renderDialog(
      <Dialog
        title="Preferences"
        titleId="preferences-title"
        role="dialog"
        ariaDescribedBy="preferences-description"
        className="custom-dialog"
      >
        <p id="preferences-description">Configure the app.</p>
      </Dialog>
    )

    const heading = queryByTextOrThrow<HTMLHeadingElement>(
      dialog,
      'h1',
      'Preferences'
    )
    assert.equal(heading.id, 'preferences-title')
    assert.ok(dialog.classList.contains('custom-dialog'))
    assert.equal(dialog.getAttribute('aria-labelledby'), 'preferences-title')
    assert.equal(
      dialog.getAttribute('aria-describedby'),
      'preferences-description'
    )
  })

  it('focuses the close button on open when requested', () => {
    const dialog = renderDialog(
      <Dialog title="Dismiss me" focusCloseButtonOnOpen={true} />,
      true
    )

    const closeButton = queryOrThrow<HTMLButtonElement>(dialog, 'button.close')
    assert.equal(document.activeElement, closeButton)
    assert.equal(dialog.getAttribute('open'), '')
  })

  it('focuses the preferred child when opened', () => {
    const dialog = renderDialog(
      <Dialog title="Focus test">
        <button type="button">First</button>
        <input className={DialogPreferredFocusClassName} />
        <button type="submit">Submit</button>
      </Dialog>,
      true
    )

    const preferred = queryOrThrow<HTMLInputElement>(
      dialog,
      `.${DialogPreferredFocusClassName}`
    )

    assert.equal(document.activeElement, preferred)
  })

  it('does not dismiss during the appearance grace period', () => {
    let dismissed = false
    const dialog = renderDialog(
      <Dialog title="Protected" onDismissed={() => (dismissed = true)} />,
      true
    )

    keyDown(dialog, 'Escape')
    assert.equal(dismissed, false)
  })

  it('dismisses on Escape after the appearance grace period', async () => {
    let dismissed = false
    const dialog = renderDialog(
      <Dialog title="Escapable" onDismissed={() => (dismissed = true)} />,
      true
    )

    await waitForDuration(300)
    keyDown(dialog, 'Escape')

    assert.equal(dismissed, true)
  })

  it('does not render a close button when dismiss is disabled', () => {
    const dialog = renderDialog(
      <Dialog title="Blocked" dismissDisabled={true} />,
      true
    )

    assert.equal(dialog.querySelector('button.close'), null)
  })

  it('submits through the provided onSubmit callback', () => {
    let submitted = false
    const dialog = renderDialog(
      <Dialog title="Submit" onSubmit={() => (submitted = true)}>
        <button type="submit">Save</button>
      </Dialog>
    )

    submit(queryOrThrow<HTMLFormElement>(dialog, 'form'))

    assert.equal(submitted, true)
  })

  it('falls back to dismissing when submitted without an onSubmit handler', async () => {
    let dismissed = false
    const dialog = renderDialog(
      <Dialog title="Fallback submit" onDismissed={() => (dismissed = true)}>
        <button type="submit">Save</button>
      </Dialog>,
      true
    )

    await waitForDuration(300)

    submit(queryOrThrow<HTMLFormElement>(dialog, 'form'))

    assert.equal(dismissed, true)
  })

  it('invokes onDialogRef with the element and null on unmount', () => {
    const refs: Array<HTMLDialogElement | null> = []
    renderDialog(
      <Dialog
        title="Refs"
        onDialogRef={element => {
          refs.push(element)
        }}
      />
    )

    unmount?.()
    unmount = undefined

    assert.equal(refs.length, 2)
    assert.ok(refs[0] instanceof HTMLElement)
    assert.equal(refs[1], null)
  })
})
