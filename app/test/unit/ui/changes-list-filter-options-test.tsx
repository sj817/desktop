import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { IFileListFilterState } from '../../../src/lib/app-state'
import {
  AppFileStatusKind,
  WorkingDirectoryStatus,
} from '../../../src/models/status'
import { ChangesListFilterOptions } from '../../../src/ui/changes/changes-list-filter-options'
import { IChangesListItem } from '../../../src/ui/changes/filter-changes-list'
import {
  buttonWithText,
  checkboxWithLabel,
  click,
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { createMockFileChange } from '../../helpers/mock-git'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})

function createFilterState(
  overrides: Partial<IFileListFilterState> = {}
): IFileListFilterState {
  return {
    filterText: '',
    isIncludedInCommit: false,
    isExcludedFromCommit: false,
    isNewFile: false,
    isModifiedFile: false,
    isDeletedFile: false,
    ...overrides,
  }
}

function createChangesListItem(
  change: ReturnType<typeof createMockFileChange>
): IChangesListItem {
  return {
    id: change.id,
    text: [change.path],
    change,
  }
}

function renderFilterOptions(fileListFilter = createFilterState()) {
  const modifiedIncluded = createMockFileChange('src/app.ts')
  const newExcluded = createMockFileChange(
    'src/new-file.ts',
    AppFileStatusKind.New
  ).withIncludeAll(false)
  const deletedIncluded = createMockFileChange(
    'src/old-file.ts',
    AppFileStatusKind.Deleted
  )

  const workingDirectory = WorkingDirectoryStatus.fromFiles([
    modifiedIncluded,
    newExcluded,
    deletedIncluded,
  ])

  const filteredItems = new Map<string, IChangesListItem>([
    [modifiedIncluded.id, createChangesListItem(modifiedIncluded)],
    [newExcluded.id, createChangesListItem(newExcluded)],
    [deletedIncluded.id, createChangesListItem(deletedIncluded)],
  ])

  const calls = {
    included: 0,
    excluded: 0,
    deleted: 0,
    modified: 0,
    newFiles: 0,
    clear: 0,
  }

  const rendered = renderComponent(
    <ChangesListFilterOptions
      fileListFilter={fileListFilter}
      filteredItems={filteredItems}
      workingDirectory={workingDirectory}
      onFilterToIncludedInCommit={() => {
        calls.included += 1
      }}
      onFilterExcludedFiles={() => {
        calls.excluded += 1
      }}
      onFilterDeletedFiles={() => {
        calls.deleted += 1
      }}
      onFilterModifiedFiles={() => {
        calls.modified += 1
      }}
      onFilterNewFiles={() => {
        calls.newFiles += 1
      }}
      onClearAllFilters={() => {
        calls.clear += 1
      }}
    />
  )

  return {
    ...rendered,
    calls,
  }
}

describe('ChangesListFilterOptions', () => {
  it('renders an active filter button label and badge when filters are applied', () => {
    const { container, unmount: u } = renderFilterOptions(
      createFilterState({ isModifiedFile: true, isDeletedFile: true })
    )
    unmount = u

    const button = queryOrThrow<HTMLButtonElement>(
      container,
      'button.filter-button'
    )
    assert.ok(button.classList.contains('active'))
    assert.equal(
      button.getAttribute('aria-label'),
      'Filter Options (2 applied)'
    )
    assert.ok(container.querySelector('.active-badge'))
  })

  it('shows filter counts and clears filters from the popover', () => {
    const {
      container,
      unmount: u,
      calls,
    } = renderFilterOptions(createFilterState({ isIncludedInCommit: true }))
    unmount = u

    click(queryOrThrow(container, 'button.filter-button'))

  queryByTextOrThrow(container, 'h3', 'Filter Options')
  checkboxWithLabel(container, 'Included in commit (2)')
  checkboxWithLabel(container, 'Excluded from commit (1)')
  checkboxWithLabel(container, 'New files (1)')
  checkboxWithLabel(container, 'Modified files (1)')
  checkboxWithLabel(container, 'Deleted files (1)')

  click(buttonWithText(container, 'Clear filters'))

    assert.equal(calls.clear, 1)
    assert.equal(container.querySelector('.filter-popover'), null)
  })

  it('invokes the selected filter callback and closes the popover', () => {
    const { container, unmount: u, calls } = renderFilterOptions()
    unmount = u

    click(queryOrThrow(container, 'button.filter-button'))

    click(checkboxWithLabel(container, 'Modified files (1)'))

    assert.equal(calls.modified, 1)
    assert.equal(container.querySelector('.filter-popover'), null)
  })
})
