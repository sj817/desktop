import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import {
  click,
  pathTextWithSegments,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { createMockFileChange } from '../../helpers/mock-git'
import { AppFileStatusKind } from '../../../src/models/status'
import { ChangedFile } from '../../../src/ui/changes/changed-file'

let unmount: (() => void) | undefined

afterEach(() => unmount?.())

describe('ChangedFile', () => {
  it('reports include changes when the checkbox is toggled', () => {
    const file = createMockFileChange('src/app.ts')
    const calls = new Array<boolean>()

    const { container, unmount: u } = renderComponent(
      <ChangedFile
        file={file}
        include={false}
        availableWidth={240}
        disableSelection={false}
        focused={false}
        onIncludeChanged={(_, include) => calls.push(include)}
      />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )

    click(input)

    assert.deepEqual(calls, [true])
  })

  it('renders mixed include state as indeterminate', () => {
    const { container, unmount: u } = renderComponent(
      <ChangedFile
        file={createMockFileChange('src/app.ts')}
        include={null}
        availableWidth={240}
        disableSelection={false}
        focused={false}
        onIncludeChanged={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )

    assert.equal(input.indeterminate, true)
  })

  it('renders copied and renamed paths with a rename arrow', () => {
    const { container, unmount: u } = renderComponent(
      <ChangedFile
        file={createMockFileChange(
          'src/new-name.ts',
          AppFileStatusKind.Renamed
        )}
        include={true}
        availableWidth={240}
        disableSelection={false}
        focused={false}
        onIncludeChanged={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    pathTextWithSegments(container, 'src/', 'new-name.ts.old')
    pathTextWithSegments(container, 'src/', 'new-name.ts')
    queryOrThrow(container, '.rename-arrow')
  })

  it('announces file status and inclusion through the aria live region', () => {
    const { container, unmount: u } = renderComponent(
      <ChangedFile
        file={createMockFileChange(
          'src/feature.ts',
          AppFileStatusKind.Modified
        )}
        include={true}
        availableWidth={240}
        disableSelection={false}
        focused={false}
        onIncludeChanged={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const ariaLive = queryOrThrow(container, '.sr-only')
    assert.equal(ariaLive.textContent, 'src/feature.ts Modified included')
  })

  it('disables selection when requested', () => {
    const { container, unmount: u } = renderComponent(
      <ChangedFile
        file={createMockFileChange('src/app.ts')}
        include={true}
        availableWidth={240}
        disableSelection={true}
        focused={false}
        onIncludeChanged={() => {
          throw new Error('should not be called')
        }}
      />
    )
    unmount = u

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input[type="checkbox"]'
    )

    assert.equal(input.disabled, true)
  })
})
