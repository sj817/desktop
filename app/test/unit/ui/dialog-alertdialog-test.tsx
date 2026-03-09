import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import { keyDown, queryOrThrow, renderComponent } from '../../helpers/component-test-utils'
import { Dialog, DialogStackContext } from '../../../src/ui/dialog/dialog'

let unmount: (() => void) | undefined

const originalDarwin = __DARWIN__
const originalWin32 = __WIN32__

afterEach(() => {
  unmount?.()
  unmount = undefined
  document.body.innerHTML = ''
  Object.assign(globalThis, {
    __DARWIN__: originalDarwin,
    __WIN32__: originalWin32,
  })
})

function renderDialog(element: React.ReactElement): HTMLElement {
  const rendered = renderComponent(
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      {element}
    </DialogStackContext.Provider>
  )

  unmount = rendered.unmount
  return queryOrThrow<HTMLElement>(rendered.container, 'dialog')
}

describe('Dialog Alertdialog Behavior', () => {
  it('wraps focus to the first element when tabbing forward from the last element on Windows alert dialogs', () => {
    Object.assign(globalThis, {
      __DARWIN__: false,
      __WIN32__: true,
    })

    const dialog = renderDialog(
      <Dialog
        title="Alert"
        role="alertdialog"
        ariaDescribedBy="alert-description"
      >
        <p id="alert-description">Pay attention to this dialog.</p>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Dialog>
    )

    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button')
    const closeButton = buttons[0]
    const lastButton = buttons[2]

    act(() => {
      lastButton.focus()
    })

    keyDown(dialog, 'Tab')

    assert.equal(document.activeElement, closeButton)
  })

  it('wraps focus to the last element when shift-tabbing backward from the first element on Windows alert dialogs', () => {
    Object.assign(globalThis, {
      __DARWIN__: false,
      __WIN32__: true,
    })

    const dialog = renderDialog(
      <Dialog
        title="Alert"
        role="alertdialog"
        ariaDescribedBy="alert-description"
      >
        <p id="alert-description">Pay attention to this dialog.</p>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Dialog>
    )

    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button')
    const closeButton = buttons[0]
    const lastButton = buttons[2]

    act(() => {
      closeButton.focus()
    })

    keyDown(dialog, 'Tab', { shiftKey: true })

    assert.equal(document.activeElement, lastButton)
  })
})