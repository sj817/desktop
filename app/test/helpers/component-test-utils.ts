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

function shouldPreventDefaultClickActivation(element: Element): boolean {
  if (element instanceof HTMLButtonElement) {
    return element.form !== null && element.type !== 'button'
  }

  if (element instanceof HTMLInputElement) {
    return (
      element.form !== null &&
      ['submit', 'reset', 'image'].includes(element.type)
    )
  }

  return false
}

/**
 * Simulates a click event on the given element within an `act()` block.
 */
export function click(element: Element) {
  act(() => {
    if (shouldPreventDefaultClickActivation(element)) {
      const preventDefault = (event: Event) => {
        event.preventDefault()
      }

      element.addEventListener('click', preventDefault, {
        capture: true,
        once: true,
      })
    }

    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )
  })
}

function normalizeTextContent(text: string | null): string {
  return text?.replace(/\s+/g, ' ').trim() ?? ''
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
 * Simulates a blur event on an element.
 */
export function blur(element: Element) {
  act(() => {
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
  })
}

/**
 * Simulates a mouse down event on an element.
 */
export function mouseDown(
  element: Element,
  options: Partial<MouseEventInit> = {}
) {
  act(() => {
    element.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        ...options,
      })
    )
  })
}

/**
 * Simulates a mouse up event on an element.
 */
export function mouseUp(
  element: Element,
  options: Partial<MouseEventInit> = {}
) {
  act(() => {
    element.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        ...options,
      })
    )
  })
}

/**
 * Simulates a mouse over event on an element.
 */
export function mouseOver(
  element: Element,
  options: Partial<MouseEventInit> = {}
) {
  act(() => {
    element.dispatchEvent(
      new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        ...options,
      })
    )
  })
}

/**
 * Simulates a mouse out event on an element.
 */
export function mouseOut(
  element: Element,
  options: Partial<MouseEventInit> = {}
) {
  act(() => {
    element.dispatchEvent(
      new MouseEvent('mouseout', {
        bubbles: true,
        cancelable: true,
        ...options,
      })
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

/**
 * Queries for an element with matching normalized text content and asserts it exists.
 */
export function queryByTextOrThrow<T extends Element>(
  container: HTMLElement,
  selector: string,
  text: string
): T {
  const normalizedText = normalizeTextContent(text)
  const matches = Array.from(container.querySelectorAll<T>(selector)).filter(
    element => normalizeTextContent(element.textContent) === normalizedText
  )

  if (matches.length === 0) {
    throw new Error(
      `Could not find element matching "${selector}" with text "${normalizedText}" in:\n${container.innerHTML}`
    )
  }

  if (matches.length > 1) {
    throw new Error(
      `Found multiple elements matching "${selector}" with text "${normalizedText}" in:\n${container.innerHTML}`
    )
  }

  return matches[0]
}

/**
 * Queries for a button with matching normalized text content and asserts it exists.
 */
export function buttonWithText(
  container: HTMLElement,
  text: string
): HTMLButtonElement {
  return queryByTextOrThrow<HTMLButtonElement>(container, 'button', text)
}

/**
 * Queries for a checkbox by its rendered label text and asserts it exists.
 */
export function checkboxWithLabel(
  container: HTMLElement,
  text: string
): HTMLInputElement {
  const checkbox = queryByTextOrThrow<HTMLLabelElement>(
    container,
    '.checkbox-component label',
    text
  ).parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]')

  if (checkbox === null || checkbox === undefined) {
    throw new Error(
      `Could not find checkbox for label "${text}" in:\n${container.innerHTML}`
    )
  }

  return checkbox
}

/**
 * Queries for a radio button by its rendered label text and asserts it exists.
 */
export function radioButtonWithLabel(
  container: HTMLElement,
  text: string
): HTMLInputElement {
  const radio = queryByTextOrThrow<HTMLLabelElement>(
    container,
    '.radio-button-component label',
    text
  ).querySelector<HTMLInputElement>('input[type="radio"]')

  if (radio === null || radio === undefined) {
    throw new Error(
      `Could not find radio button for label "${text}" in:\n${container.innerHTML}`
    )
  }

  return radio
}

/**
 * Dispatches a submit event on a form within an `act()` block.
 */
export function submit(form: HTMLFormElement) {
  act(() => {
    form.dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    )
  })
}

/**
 * Waits for a short timer-driven UI grace period.
 */
export function waitForDuration(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}
