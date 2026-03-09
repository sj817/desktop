import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import { queryOrThrow, renderComponent } from '../../helpers/component-test-utils'
import { Dialog, DialogStackContext } from '../../../src/ui/dialog/dialog'
import { getTitleBarHeight } from '../../../src/ui/window/title-bar'

let unmount: (() => void) | undefined

const originalRequestAnimationFrame = globalThis.requestAnimationFrame
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame
const originalInnerHeight = window.innerHeight

afterEach(() => {
  unmount?.()
  unmount = undefined
  document.body.innerHTML = ''

  Object.assign(globalThis, {
    requestAnimationFrame: originalRequestAnimationFrame,
    cancelAnimationFrame: originalCancelAnimationFrame,
  })

  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: originalInnerHeight,
  })
})

function renderDialog(): HTMLElement {
  const rendered = renderComponent(
    <DialogStackContext.Provider value={{ isTopMost: true }}>
      <Dialog title="Resizable">
        <p>Dialog content</p>
      </Dialog>
    </DialogStackContext.Provider>
  )

  unmount = rendered.unmount
  return queryOrThrow<HTMLElement>(rendered.container, 'dialog')
}

function stubAnimationFrame() {
  Object.assign(globalThis, {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    },
    cancelAnimationFrame: () => {},
  })
}

function stubDialogDimensions(
  dialog: HTMLElement,
  offsetTop: number,
  offsetHeight: number
) {
  Object.defineProperty(dialog, 'offsetTop', {
    configurable: true,
    value: offsetTop,
  })
  Object.defineProperty(dialog, 'offsetHeight', {
    configurable: true,
    value: offsetHeight,
  })
}

describe('Dialog Resize Behavior', () => {
  it('repositions the dialog upward when a resize would push it below the viewport', () => {
    stubAnimationFrame()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 400,
    })

    const dialog = renderDialog()
    stubDialogDimensions(dialog, 260, 160)

    act(() => {
      window.dispatchEvent(new window.Event('resize'))
    })

    const expectedTop = 230
    assert.equal(dialog.style.top, `${expectedTop}px`)
  })

  it('does not reposition dialogs that are taller than the available viewport', () => {
    stubAnimationFrame()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 300,
    })

    const dialog = renderDialog()
    stubDialogDimensions(dialog, 120, 1000)

    act(() => {
      window.dispatchEvent(new window.Event('resize'))
    })

    assert.equal(dialog.style.top, '')
    assert.ok(dialog.offsetHeight > window.innerHeight - getTitleBarHeight())
  })
})