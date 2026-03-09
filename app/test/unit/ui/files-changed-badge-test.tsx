import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import {
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { FilesChangedBadge } from '../../../src/ui/changes/files-changed-badge'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

describe('FilesChangedBadge', () => {
  it('renders the current file count when under the maximum threshold', () => {
    const { container, unmount: u } = renderComponent(
      <FilesChangedBadge filesChangedCount={12} />
    )
    unmount = u

    const badge = queryOrThrow(container, '.counter')
    assert.equal(badge.textContent, '12')
  })

  it('renders the exact maximum count without truncating it', () => {
    const { container, unmount: u } = renderComponent(
      <FilesChangedBadge filesChangedCount={300} />
    )
    unmount = u

    const badge = queryOrThrow(container, '.counter')
    assert.equal(badge.textContent, '300')
  })

  it('caps counts above the maximum threshold', () => {
    const { container, unmount: u } = renderComponent(
      <FilesChangedBadge filesChangedCount={301} />
    )
    unmount = u

    const badge = queryOrThrow(container, '.counter')
    assert.equal(badge.textContent, '300+')
  })
})
