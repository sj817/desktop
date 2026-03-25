import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import {
  queryOrThrow,
  renderComponent,
  stubAnimationFrame,
  stubWindowInnerHeight,
} from '../../helpers/component-test-utils'
import { Dialog, DialogStackContext } from '../../../src/ui/dialog/dialog'
import { getTitleBarHeight } from '../../../src/ui/window/title-bar'

let unmount: (() => void) | undefined
let restoreAnimationFrameStub: (() => void) | undefined
let restoreWindowHeightStub: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
  document.body.innerHTML = ''

  restoreAnimationFrameStub?.()
  restoreAnimationFrameStub = undefined

  restoreWindowHeightStub?.()
  restoreWindowHeightStub = undefined
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
    restoreAnimationFrameStub = stubAnimationFrame()
    restoreWindowHeightStub = stubWindowInnerHeight(400)

    const dialog = renderDialog()
    stubDialogDimensions(dialog, 260, 160)

    act(() => {
      window.dispatchEvent(new window.Event('resize'))
    })

    const expectedTop = 230
    assert.equal(dialog.style.top, `${expectedTop}px`)
  })

  it('does not reposition dialogs that are taller than the available viewport', () => {
    restoreAnimationFrameStub = stubAnimationFrame()
    restoreWindowHeightStub = stubWindowInnerHeight(300)

    const dialog = renderDialog()
    stubDialogDimensions(dialog, 120, 1000)

    act(() => {
      window.dispatchEvent(new window.Event('resize'))
    })

    assert.equal(dialog.style.top, '')
    assert.ok(dialog.offsetHeight > window.innerHeight - getTitleBarHeight())
  })
})
