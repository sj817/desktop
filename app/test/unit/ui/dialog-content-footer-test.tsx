import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import {
  renderComponent,
  queryOrThrow,
} from '../../helpers/component-test-utils'
import { DialogContent } from '../../../src/ui/dialog/content'
import { DialogFooter } from '../../../src/ui/dialog/footer'
import { OkCancelButtonGroup } from '../../../src/ui/dialog/ok-cancel-button-group'

let unmount: () => void

afterEach(() => unmount?.())

describe('DialogContent', () => {
  it('renders children inside a dialog-content div', () => {
    const { container, unmount: u } = renderComponent(
      <DialogContent>
        <p>Some content</p>
      </DialogContent>
    )
    unmount = u

    const content = queryOrThrow(container, '.dialog-content')
    assert.ok(content.querySelector('p'))
    assert.equal(content.querySelector('p')!.textContent, 'Some content')
  })

  it('applies custom className', () => {
    const { container, unmount: u } = renderComponent(
      <DialogContent className="custom-content">Content</DialogContent>
    )
    unmount = u

    const content = container.querySelector('.dialog-content.custom-content')
    assert.ok(content)
  })

  it('calls onRef with the container element', () => {
    let refTagName: string | null = null
    const handleRef = (el: HTMLDivElement | null) => {
      refTagName = el?.tagName ?? null
    }
    const { unmount: u } = renderComponent(
      <DialogContent onRef={handleRef}>Content</DialogContent>
    )
    unmount = u

    assert.equal(refTagName, 'DIV')
  })
})

describe('DialogFooter', () => {
  it('renders children inside a dialog-footer div', () => {
    const { container, unmount: u } = renderComponent(
      <DialogFooter>
        <span>Footer text</span>
      </DialogFooter>
    )
    unmount = u

    const footer = queryOrThrow(container, '.dialog-footer')
    assert.equal(footer.querySelector('span')!.textContent, 'Footer text')
  })

  it('composes with OkCancelButtonGroup', () => {
    const { container, unmount: u } = renderComponent(
      <form>
        <DialogFooter>
          <OkCancelButtonGroup okButtonText="Save" cancelButtonText="Discard" />
        </DialogFooter>
      </form>
    )
    unmount = u

    const footer = queryOrThrow(container, '.dialog-footer')
    const buttons = footer.querySelectorAll('button')
    assert.equal(buttons.length, 2)

    const texts = Array.from(buttons).map(b => b.textContent)
    assert.ok(texts.includes('Save'))
    assert.ok(texts.includes('Discard'))
  })
})
