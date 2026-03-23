import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

let container: HTMLDivElement

function setup() {
  container = document.createElement('div')
  document.body.appendChild(container)
}

afterEach(() => {
  if (container) {
    ReactDOM.unmountComponentAtNode(container)
    container.remove()
  }
})

describe('component test infrastructure', () => {
  it('can render a simple React element', () => {
    setup()
    act(() => {
      ReactDOM.render(React.createElement('div', null, 'Hello'), container)
    })
    assert.ok(container.textContent?.includes('Hello'))
  })

  it('can render a React component', () => {
    setup()
    function TestComponent() {
      return React.createElement('button', null, 'Click me')
    }
    act(() => {
      ReactDOM.render(React.createElement(TestComponent), container)
    })
    const button = container.querySelector('button')
    assert.ok(button)
    assert.equal(button!.textContent, 'Click me')
  })

  it('can fire events and assert results', () => {
    setup()
    let clicked = false
    const handleClick = () => {
      clicked = true
    }
    function TestButton() {
      return React.createElement('button', { onClick: handleClick }, 'Click')
    }
    act(() => {
      ReactDOM.render(React.createElement(TestButton), container)
    })
    const button = container.querySelector('button')!
    act(() => {
      button.click()
    })
    assert.equal(clicked, true)
  })
})
