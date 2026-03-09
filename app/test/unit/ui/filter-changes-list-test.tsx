import { afterEach, before, describe, it, mock } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { IFileListFilterState } from '../../../src/lib/app-state'
import { Account } from '../../../src/models/account'
import { IAheadBehind } from '../../../src/models/branch'
import { DefaultCommitMessage } from '../../../src/models/commit-message'
import { CommitIdentity } from '../../../src/models/commit-identity'
import { RepoRulesInfo } from '../../../src/models/repo-rules'
import { Repository } from '../../../src/models/repository'
import { WorkingDirectoryStatus } from '../../../src/models/status'
import type { IChangesListFilterOptionsProps } from '../../../src/ui/changes/changes-list-filter-options'
import type { IChangedFileProps } from '../../../src/ui/changes/changed-file'
import type { IChangesListItem } from '../../../src/ui/changes/filter-changes-list'
import { Dispatcher } from '../../../src/ui/dispatcher'
import type { IButtonProps } from '../../../src/ui/lib/button'
import type { ICheckboxProps } from '../../../src/ui/lib/checkbox'
import type { ILinkButtonProps } from '../../../src/ui/lib/link-button'
import type { ITextBoxProps } from '../../../src/ui/lib/text-box'
import type { IAugmentedSectionFilterListProps } from '../../../src/ui/lib/augmented-filter-list'
import {
  change,
  click,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'
import { createMockFileChange } from '../../helpers/mock-git'

interface IAugmentedSectionFilterListHandle {
  onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void
}

type MockAugmentedSectionFilterListProps =
  IAugmentedSectionFilterListProps<IChangesListItem>

interface IFocusableHandle {
  focus(): void
}

let FilterChangesList: typeof import('../../../src/ui/changes/filter-changes-list').FilterChangesList
let unmount: (() => void) | undefined

mock.module('../../../src/ui/lib/augmented-filter-list', {
  namedExports: {
    AugmentedSectionFilterList: React.forwardRef<
      IAugmentedSectionFilterListHandle,
      MockAugmentedSectionFilterListProps
    >((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        onKeyDown: () => {},
      }))

      const visibleItems = React.useMemo(() => {
        const text = props.filterText.toLowerCase()
        return props.groups.flatMap(group =>
          group.items.filter(item => {
            const matchesText =
              text.length === 0 ||
              item.text.join(' ').toLowerCase().includes(text)
            const matchesFilter = props.filterMethod
              ? props.filterMethod(item)
              : true
            return matchesText && matchesFilter
          })
        )
      }, [props.filterMethod, props.filterText, props.groups])

      React.useEffect(() => {
        props.onFilterListResultsChanged?.(visibleItems)
      }, [props, visibleItems])

      return (
        <div className="mock-augmented-filter-list">
          {props.renderCustomFilterRow?.()}
          <div className="rendered-items">
            {visibleItems.length > 0
              ? visibleItems.map(item =>
                  props.renderItem(item, { title: [], subtitle: [] })
                )
              : props.renderNoItems?.()}
          </div>
        </div>
      )
    }),
  },
})

mock.module('../../../src/ui/changes/changed-file', {
  namedExports: {
    ChangedFile: (props: IChangedFileProps) => (
      <div className="changed-file-row">{props.file.path}</div>
    ),
  },
})

mock.module('../../../src/ui/changes/commit-message', {
  namedExports: {
    CommitMessage: () => <div className="mock-commit-message" />,
  },
})

mock.module('../../../src/ui/changes/changes-list-filter-options', {
  namedExports: {
    ChangesListFilterOptions: (props: IChangesListFilterOptionsProps) => (
      <div className="mock-filter-options">
        <button
          type="button"
          className="filter-included"
          onClick={props.onFilterToIncludedInCommit}
        >
          Filter Included
        </button>
        <button
          type="button"
          className="clear-all-filters"
          onClick={props.onClearAllFilters}
        >
          Clear All Filters
        </button>
      </div>
    ),
  },
})

mock.module('../../../src/ui/lib/text-box', {
  namedExports: {
    TextBox: React.forwardRef<IFocusableHandle, ITextBoxProps>((props, ref) => {
      React.useImperativeHandle(ref, () => ({ focus: () => {} }))

      return (
        <input
          className={props.className}
          placeholder={props.placeholder}
          value={props.value ?? ''}
          onChange={event => props.onValueChanged?.(event.currentTarget.value)}
          onKeyDown={props.onKeyDown}
        />
      )
    }),
  },
})

mock.module('../../../src/ui/lib/checkbox', {
  namedExports: {
    CheckboxValue: { On: 1, Off: 0, Mixed: -1 },
    Checkbox: React.forwardRef<IFocusableHandle, ICheckboxProps>(
      (props, ref) => {
        React.useImperativeHandle(ref, () => ({ focus: () => {} }))
        return (
          <label className={props.className}>
            <input
              type="checkbox"
              checked={false}
              disabled={props.disabled}
              onChange={props.onChange}
            />
            <span id="changes-list-check-all-label">{props.label}</span>
          </label>
        )
      }
    ),
  },
})

mock.module('../../../src/ui/lib/button', {
  namedExports: {
    Button: (props: IButtonProps) => (
      <button
        type={props.type ?? 'button'}
        className={props.className}
        onClick={props.onClick}
        onKeyDown={props.onKeyDown}
      >
        {props.children}
      </button>
    ),
  },
})

mock.module('../../../src/ui/lib/link-button', {
  namedExports: {
    LinkButton: (props: ILinkButtonProps) => (
      <button
        type="button"
        className="link-button-component"
        onClick={() => props.onClick?.()}
      >
        {props.children}
      </button>
    ),
  },
})

mock.module('../../../src/ui/octicons', {
  namedExports: {
    Octicon: () => <span className="octicon" />,
  },
})

before(async () => {
  ;({ FilterChangesList } = await import(
    '../../../src/ui/changes/filter-changes-list'
  ))
})

afterEach(() => {
  unmount?.()
  unmount = undefined
})

function createRepository() {
  return new Repository('/tmp/desktop', 1, null, false)
}

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

function createDispatcher(calls: string[]) {
  const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
  Object.assign(dispatcher, {
    incrementMetric: (name: string) => {
      calls.push(`metric:${name}`)
    },
    setChangesListFilterText: (repository: Repository, text: string) => {
      assert.equal(repository.path, '/tmp/desktop')
      calls.push(`text:${text}`)
    },
    setIncludedChangesInCommitFilter: (
      repository: Repository,
      value: boolean
    ) => {
      assert.equal(repository.path, '/tmp/desktop')
      calls.push(`included:${value}`)
    },
    setFilterExcludedFiles: (repository: Repository, value: boolean) => {
      assert.equal(repository.path, '/tmp/desktop')
      calls.push(`excluded:${value}`)
    },
    setFilterNewFiles: (repository: Repository, value: boolean) => {
      assert.equal(repository.path, '/tmp/desktop')
      calls.push(`new:${value}`)
    },
    setFilterModifiedFiles: (repository: Repository, value: boolean) => {
      assert.equal(repository.path, '/tmp/desktop')
      calls.push(`modified:${value}`)
    },
    setFilterDeletedFiles: (repository: Repository, value: boolean) => {
      assert.equal(repository.path, '/tmp/desktop')
      calls.push(`deleted:${value}`)
    },
    setCommitMessageFocus: () => {},
    setCommitMessage: () => {},
    promptOverrideWithGeneratedCommitMessage: () => {},
    generateCommitMessage: () => {},
    showPopup: () => {},
    updateShowCoAuthoredBy: () => {},
    updateCommitCoAuthors: () => {},
    showUnknownAuthorsCommitWarning: () => {},
    refreshAuthor: () => {},
    createStashForCurrentBranch: () => {},
    onDismissPopup: () => {},
  })
  return dispatcher
}

function renderFilterChangesList(
  props: {
    fileListFilter?: IFileListFilterState
    workingDirectory?: WorkingDirectoryStatus
  } = {}
) {
  const calls = new Array<string>()
  const includedFile = createMockFileChange('src/app.ts')
  const excludedFile =
    createMockFileChange('docs/readme.md').withIncludeAll(false)
  const workingDirectory =
    props.workingDirectory ??
    WorkingDirectoryStatus.fromFiles([includedFile, excludedFile])

  const rendered = renderComponent(
    <FilterChangesList
      repository={createRepository()}
      repositoryAccount={null}
      workingDirectory={workingDirectory}
      mostRecentLocalCommit={null}
      conflictState={null}
      rebaseConflictState={null}
      selectedFileIDs={[]}
      onFileSelectionChanged={() => {}}
      onIncludeChanged={() => {}}
      onCreateCommit={async () => true}
      onDiscardChanges={() => {}}
      askForConfirmationOnDiscardChanges={true}
      askForConfirmationOnCommitFilteredChanges={true}
      focusCommitMessage={false}
      isShowingModal={false}
      isShowingFoldout={false}
      onDiscardChangesFromFiles={() => {}}
      onChangesListScrolled={() => {}}
      onOpenItem={() => {}}
      onOpenItemInExternalEditor={() => {}}
      branch="main"
      commitAuthor={
        new CommitIdentity('Desktop', 'desktop@example.com', new Date())
      }
      dispatcher={createDispatcher(calls)}
      availableWidth={300}
      isCommitting={false}
      hookProgress={null}
      isGeneratingCommitMessage={false}
      shouldShowGenerateCommitMessageCallOut={false}
      commitToAmend={null}
      currentBranchProtected={false}
      currentRepoRulesInfo={new RepoRulesInfo()}
      aheadBehind={{ ahead: 0, behind: 0 } as IAheadBehind}
      commitMessage={DefaultCommitMessage}
      autocompletionProviders={[]}
      onIgnoreFile={() => {}}
      onIgnorePattern={() => {}}
      showCoAuthoredBy={false}
      coAuthors={[]}
      stashEntry={null}
      isShowingStashEntry={false}
      shouldNudgeToCommit={false}
      commitSpellcheckEnabled={true}
      showCommitLengthWarning={true}
      accounts={[] as ReadonlyArray<Account>}
      fileListFilter={props.fileListFilter ?? createFilterState()}
      showChangesFilter={true}
      hasCommitHooks={false}
      skipCommitHooks={false}
      onUpdateCommitOptions={() => {}}
    />
  )

  return {
    ...rendered,
    calls,
  }
}

describe('FilterChangesList', () => {
  it('filters rendered files by filter text and dispatches filter text changes', () => {
    const {
      container,
      unmount: u,
      calls,
    } = renderFilterChangesList({
      fileListFilter: createFilterState({ filterText: 'src' }),
    })
    unmount = u

    assert.ok(container.textContent?.includes('src/app.ts'))
    assert.equal(container.textContent?.includes('docs/readme.md'), false)

    const input = queryOrThrow<HTMLInputElement>(
      container,
      'input.filter-list-filter-field'
    )
    change(input, 'docs')

    assert.deepEqual(calls, ['text:docs'])
  })

  it('renders the filtered empty state and clears all active filters', () => {
    const {
      container,
      unmount: u,
      calls,
    } = renderFilterChangesList({
      fileListFilter: createFilterState({
        filterText: 'missing',
        isModifiedFile: true,
      }),
    })
    unmount = u

    assert.ok(
      container.textContent?.includes('No files match your current filters')
    )
    assert.ok(container.textContent?.includes('"missing"'))
    assert.ok(container.textContent?.includes('Modified files'))

    click(queryOrThrow<HTMLButtonElement>(container, '.clear-filters-button'))

    assert.deepEqual(calls, [
      'metric:appliesClearAllChangesListFilterCount',
      'text:',
      'included:false',
      'excluded:false',
      'new:false',
      'modified:false',
      'deleted:false',
    ])
  })

  it('shows hidden committed changes and adjusts filters to reveal them', () => {
    const includedFile = createMockFileChange('src/app.ts')
    const excludedFile =
      createMockFileChange('docs/readme.md').withIncludeAll(false)
    const {
      container,
      unmount: u,
      calls,
    } = renderFilterChangesList({
      workingDirectory: WorkingDirectoryStatus.fromFiles([
        includedFile,
        excludedFile,
      ]),
      fileListFilter: createFilterState({ isExcludedFromCommit: true }),
    })
    unmount = u

    assert.ok(
      container.textContent?.includes('Hidden changes will be committed.')
    )

    click(queryOrThrow<HTMLButtonElement>(container, '.link-button-component'))

    assert.deepEqual(calls, [
      'metric:adjustedFiltersForHiddenChangesCount',
      'text:',
      'excluded:false',
      'new:false',
      'modified:false',
      'deleted:false',
      'included:true',
    ])
  })
})
