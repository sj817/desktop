import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import {
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { MultipleSelection } from '../../../src/ui/changes/multiple-selection'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

describe('MultipleSelection', () => {
  it('renders the selected file count', () => {
    const { container, unmount: u } = renderComponent(
      <MultipleSelection count={4} />
    )
    unmount = u

    queryByTextOrThrow(container, '#no-changes > div', '4 files selected')
  })

  it('renders the blankslate container styling and id', () => {
    const { container, unmount: u } = renderComponent(
      <MultipleSelection count={2} />
    )
    unmount = u

    const panel = queryOrThrow<HTMLDivElement>(container, '#no-changes')
    assert.ok(panel.classList.contains('panel'))
    assert.ok(panel.classList.contains('blankslate'))
  })

  it('renders a decorative blankslate image', () => {
    const { container, unmount: u } = renderComponent(
      <MultipleSelection count={1} />
    )
    unmount = u

    const image = queryOrThrow<HTMLImageElement>(
      container,
      'img.blankslate-image'
    )
    assert.equal(image.alt, '')
  })
})
