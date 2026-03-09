import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { DiffType } from '../../../src/models/diff'
import { AppFileStatusKind } from '../../../src/models/status'
import { DiffHeader } from '../../../src/ui/diff/diff-header'
import {
  click,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let unmount: (() => void) | undefined
let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined

  if (originalGetBoundingClientRect !== undefined) {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    originalGetBoundingClientRect = undefined
  }
})

function stubElementWidth(width: number) {
  originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      width,
      height: 24,
      top: 0,
      left: 0,
      bottom: 24,
      right: width,
      x: 0,
      y: 0,
      toJSON() {
        return this
      },
    }) as DOMRect
}

describe('DiffHeader', () => {
  it('renders the path label, diff options, and file status', () => {
    stubElementWidth(480)

    const { container, unmount: u } = renderComponent(
      <DiffHeader
        path="src/diff-view.tsx"
        status={{ kind: AppFileStatusKind.Modified }}
        diff={null}
        showSideBySideDiff={false}
        onShowSideBySideDiffChanged={() => {
          throw new Error('should not be called')
        }}
        hideWhitespaceInDiff={false}
        onHideWhitespaceInDiffChanged={async () => {
          throw new Error('should not be called')
        }}
        onDiffOptionsOpened={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const pathLabel = queryOrThrow(container, '.path-label-component')
    assert.ok(pathLabel.textContent?.includes('src/diff-view.tsx'))

    const statusIcon = queryOrThrow(container, '.status.status-modified')
    assert.equal(statusIcon.getAttribute('aria-label'), 'Modified')

    assert.ok(container.querySelector('.diff-options-component button'))
  })

  it('omits diff options for submodule diffs', () => {
    stubElementWidth(480)

    const { container, unmount: u } = renderComponent(
      <DiffHeader
        path="vendor/desktop-notifications"
        status={{ kind: AppFileStatusKind.Modified }}
        diff={{
          kind: DiffType.Submodule,
          fullPath: '/tmp/vendor/desktop-notifications',
          path: 'vendor/desktop-notifications',
          url: 'https://github.com/example/example',
          status: {
            commitChanged: true,
            modifiedChanges: false,
            untrackedChanges: false,
          },
          oldSHA: '1111111',
          newSHA: '2222222',
        }}
        showSideBySideDiff={false}
        onShowSideBySideDiffChanged={() => {
          throw new Error('should not be called')
        }}
        hideWhitespaceInDiff={false}
        onHideWhitespaceInDiffChanged={async () => {
          throw new Error('should not be called')
        }}
        onDiffOptionsOpened={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    assert.equal(container.querySelector('.diff-options-component'), null)
  })

  it('opens the diff options popover from the header button', () => {
    stubElementWidth(480)

    const calls = new Array<string>()

    const { container, unmount: u } = renderComponent(
      <DiffHeader
        path="src/diff-view.tsx"
        status={{ kind: AppFileStatusKind.Modified }}
        diff={null}
        showSideBySideDiff={false}
        onShowSideBySideDiffChanged={() => {
          throw new Error('should not be called')
        }}
        hideWhitespaceInDiff={false}
        onHideWhitespaceInDiffChanged={async () => {
          throw new Error('should not be called')
        }}
        onDiffOptionsOpened={() => {
          calls.push('opened')
        }}
      />
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      '.diff-options-component button'
    )

    click(button)

    assert.equal(button.getAttribute('aria-expanded'), 'true')
    assert.ok(container.textContent?.includes(__DARWIN__ ? 'Diff Settings' : 'Diff Options'))
    assert.deepEqual(calls, ['opened'])

    click(button)

    assert.equal(button.getAttribute('aria-expanded'), 'false')
  })
})