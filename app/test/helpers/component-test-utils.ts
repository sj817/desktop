import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

/**
 * Helper for rendering React components in tests.
 *
 * Creates a DOM container, renders the component into it, and provides
 * utilities for querying and cleanup.
 *
 * Usage:
 * ```ts
 * const { container, unmount } = renderComponent(<MyComponent prop="value" />)
 * const button = container.querySelector('button')
 * assert.ok(button)
 * unmount()
 * ```
 */
export function renderComponent(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  act(() => {
    ReactDOM.render(element, container)
  })

  return {
    container,
    unmount: () => {
      ReactDOM.unmountComponentAtNode(container)
      container.remove()
    },
  }
}

/**
 * Simulates a click event on the given element within an `act()` block.
 */
export function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/**
 * Simulates a change event on an input/checkbox/select element.
 */
export function change(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string | boolean
) {
  act(() => {
    if (typeof value === 'boolean' && element instanceof HTMLInputElement) {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'checked'
      )?.set?.call(element, value)
    } else {
      if (typeof value !== 'string') {
        throw new Error('Boolean values are only supported for input elements')
      }

      const prototype =
        element instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLTextAreaElement.prototype
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')

      if (descriptor?.set !== undefined) {
        descriptor.set.call(element, value)
      } else {
        element.value = value
      }
    }
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

/**
 * Simulates a keyboard event on an element.
 */
export function keyDown(
  element: Element,
  key: string,
  options: Partial<KeyboardEventInit> = {}
) {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, ...options })
    )
  })
}

/**
 * Queries the container for an element matching the selector and asserts it exists.
 */
export function queryOrThrow<T extends Element>(
  container: HTMLElement,
  selector: string
): T {
  const el = container.querySelector<T>(selector)
  if (!el) {
    throw new Error(
      `Could not find element matching "${selector}" in:\n${container.innerHTML}`
    )
  }
  return el
}
