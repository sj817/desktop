import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { Dialog, DialogStackContext } from '../../../src/ui/dialog/dialog'
import {
  mouseDown,
  mouseUp,
  queryOrThrow,
  renderComponent,
  waitForDuration,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
  document.body.innerHTML = ''
})

function renderDialog(
  element: React.ReactElement,
  isTopMost = true
): HTMLElement {
  const rendered = renderComponent(
    <DialogStackContext.Provider value={{ isTopMost }}>
      {element}
    </DialogStackContext.Provider>
  )

  unmount = rendered.unmount
  return queryOrThrow<HTMLElement>(rendered.container, 'dialog')
}

function stubDialogRect(dialog: HTMLElement) {
  Object.defineProperty(dialog, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      top: 120,
      left: 160,
      width: 320,
      height: 180,
      right: 480,
      bottom: 300,
      x: 160,
      y: 120,
      toJSON() {
        return this
      },
    }),
  })
}

function dispatchBackdropDismiss(dialog: HTMLElement) {
  mouseDown(dialog, { clientX: 40, clientY: 80 })
  mouseUp(document, { clientX: 40, clientY: 80 })
}

describe('Dialog Backdrop Behavior', () => {
  it('dismisses when the backdrop is clicked after the grace period', async () => {
    let dismissed = false
    const dialog = renderDialog(
      <Dialog title="Backdrop" onDismissed={() => (dismissed = true)} />
    )

    stubDialogRect(dialog)
    await waitForDuration(300)

    dispatchBackdropDismiss(dialog)

    assert.equal(dismissed, true)
  })

  it('does not dismiss when backdrop dismissal is disabled', async () => {
    let dismissed = false
    const dialog = renderDialog(
      <Dialog
        title="Protected"
        backdropDismissable={false}
        onDismissed={() => (dismissed = true)}
      />
    )

    stubDialogRect(dialog)
    await waitForDuration(300)

    dispatchBackdropDismiss(dialog)

    assert.equal(dismissed, false)
  })
})
