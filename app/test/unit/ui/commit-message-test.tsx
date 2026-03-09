import { afterEach, before, describe, it, mock } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { act } from 'react-dom/test-utils'

import { Account } from '../../../src/models/account'
import { Author, UnknownAuthor } from '../../../src/models/author'
import { ICommitContext } from '../../../src/models/commit'
import { DefaultCommitMessage } from '../../../src/models/commit-message'
import { CommitIdentity } from '../../../src/models/commit-identity'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { RepoRulesInfo } from '../../../src/models/repo-rules'
import { Repository } from '../../../src/models/repository'
import {
  change,
  click,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

let CommitMessage: typeof import('../../../src/ui/changes/commit-message').CommitMessage
let unmount: (() => void) | undefined

class MockCoAuthorAutocompletionProvider {}

mock.module('../../../src/ui/autocompletion', {
  namedExports: {
    CoAuthorAutocompletionProvider: MockCoAuthorAutocompletionProvider,
    AutocompletingInput: (props: any) => (
      <input
        className={props.className}
        aria-label={props.screenReaderLabel}
        placeholder={props.placeholder}
        value={props.value}
        readOnly={props.readOnly}
        spellCheck={props.spellcheck}
        onContextMenu={props.onContextMenu}
        onChange={event => props.onValueChanged(event.currentTarget.value)}
        ref={props.onElementRef}
      />
    ),
    AutocompletingTextArea: React.forwardRef<any, any>((props, ref) => {
      const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null)

      React.useImperativeHandle(ref, () => ({
        focus: () => textAreaRef.current?.focus(),
      }))

      return (
        <textarea
          id={props.inputId}
          className={props.className}
          aria-label={props.screenReaderLabel}
          placeholder={props.placeholder}
          value={props.value}
          readOnly={props.readOnly}
          spellCheck={props.spellcheck}
          onContextMenu={props.onContextMenu}
          onChange={event => props.onValueChanged(event.currentTarget.value)}
          ref={element => {
            textAreaRef.current = element
            props.onElementRef?.(element)
          }}
        />
      )
    }),
  },
})

mock.module('../../../src/ui/lib/button', {
  namedExports: {
    Button: (props: any) => (
      <button
        type={props.type ?? 'button'}
        className={['button-component', props.className]
          .filter(Boolean)
          .join(' ')}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props.ariaLabel}
        aria-describedby={props.ariaDescribedBy}
      >
        {props.children}
      </button>
    ),
  },
})

mock.module('../../../src/ui/lib/focus-container', {
  namedExports: {
    FocusContainer: (props: any) => (
      <div className={props.className} onClick={props.onClick}>
        {props.children}
      </div>
    ),
  },
})

mock.module('../../../src/ui/changes/commit-message-avatar', {
  namedExports: {
    CommitMessageAvatar: () => <div className="commit-message-avatar" />,
  },
})

mock.module('../../../src/ui/lib/author-input/author-input', {
  namedExports: {
    AuthorInput: React.forwardRef<any, any>((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        focus: () => {},
      }))

      return <div className="author-input">{props.authors.length}</div>
    }),
  },
})

mock.module('../../../src/ui/lib/loading', {
  namedExports: {
    Loading: () => <span className="loading" />,
  },
})

mock.module('../../../src/ui/octicons', {
  namedExports: {
    Octicon: () => <span className="octicon" />,
  },
})

mock.module('../../../src/ui/changes/commit-warning', {
  namedExports: {
    CommitWarning: (props: any) => (
      <div className="commit-warning">{props.children}</div>
    ),
    CommitWarningIcon: { Information: 'information' },
  },
})

mock.module('../../../src/ui/lib/link-button', {
  namedExports: {
    LinkButton: (props: any) => (
      <button
        type="button"
        className="link-button-component"
        onClick={props.onClick}
      >
        {props.children}
      </button>
    ),
  },
})

mock.module('../../../src/ui/lib/toggletipped-content', {
  namedExports: {
    ToggledtippedContent: (props: any) => (
      <div className={props.className}>{props.children}</div>
    ),
  },
})

mock.module('../../../src/ui/lib/popover', {
  namedExports: {
    Popover: (props: any) => <div className="popover">{props.children}</div>,
    PopoverAnchorPosition: { Bottom: 'bottom' },
    PopoverDecoration: { None: 'none' },
  },
})

mock.module('../../../src/ui/repository-rules/repo-rulesets-for-branch-link', {
  namedExports: {
    RepoRulesetsForBranchLink: () => null,
  },
})

mock.module('../../../src/ui/repository-rules/repo-rules-failure-list', {
  namedExports: {
    RepoRulesMetadataFailureList: () => null,
  },
})

mock.module('../../../src/ui/accessibility/aria-live-container', {
  namedExports: {
    AriaLiveContainer: () => null,
  },
})

mock.module('../../../src/lib/helpers/repo-rules', {
  namedExports: {
    useRepoRulesLogic: () => false,
  },
})

mock.module('../../../src/lib/format-commit-message', {
  namedExports: {
    formatCommitMessage: async (
      _repository: Repository,
      context: ICommitContext
    ) => `${context.summary}\n${context.description ?? ''}`,
  },
})

mock.module('../../../src/ui/lib/timing', {
  namedExports: {
    startTimer: () => ({ done: () => {} }),
  },
})

before(async () => {
  ;({ CommitMessage } = await import('../../../src/ui/changes/commit-message'))
})

afterEach(() => {
  unmount?.()
  unmount = undefined
})

function createRepository(withGitHubRepository = true) {
  const gitHubRepository = withGitHubRepository
    ? new GitHubRepository(
        'desktop',
        new Owner('desktop', 'https://github.com', 1),
        1,
        false,
        'https://github.com/desktop/desktop',
        'https://github.com/desktop/desktop.git'
      )
    : null

  return new Repository('/tmp/desktop', 1, gitHubRepository, false)
}

function createAccount() {
  return new Account(
    'desktop',
    'https://api.github.com',
    'token',
    [],
    '',
    1,
    'Desktop'
  )
}

function createKnownAuthor(name: string): Author {
  return {
    kind: 'known',
    name,
    email: `${name.toLowerCase()}@example.com`,
    username: name.toLowerCase(),
  }
}

function createUnknownAuthor(username: string): UnknownAuthor {
  return {
    kind: 'unknown',
    username,
    state: 'error',
  }
}

function changeTextArea(element: HTMLTextAreaElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set?.call(element, value)
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function renderCommitMessage(
  props: {
    anyFilesSelected?: boolean
    prepopulateCommitSummary?: boolean
    placeholder?: string
    repository?: Repository
    coAuthors?: ReadonlyArray<Author>
    showCoAuthoredBy?: boolean
    onCreateCommit?: (context: ICommitContext) => Promise<boolean>
    onConfirmCommitWithUnknownCoAuthors?: (
      authors: ReadonlyArray<UnknownAuthor>,
      onCommitAnyway: () => void
    ) => void
  } = {}
) {
  const onCreateCommitCalls = new Array<ICommitContext>()

  const rendered = renderComponent(
    <CommitMessage
      onCreateCommit={
        props.onCreateCommit ??
        (async context => {
          onCreateCommitCalls.push(context)
          return true
        })
      }
      branch="main"
      commitAuthor={
        new CommitIdentity('Desktop', 'desktop@example.com', new Date())
      }
      anyFilesSelected={props.anyFilesSelected ?? true}
      filesToBeCommittedCount={1}
      showPromptForCommittingFileHiddenByFilter={false}
      isShowingModal={false}
      isShowingFoldout={false}
      anyFilesAvailable={true}
      filesSelected={[]}
      focusCommitMessage={false}
      commitMessage={DefaultCommitMessage}
      repository={props.repository ?? createRepository()}
      repositoryAccount={null}
      autocompletionProviders={[new MockCoAuthorAutocompletionProvider()]}
      hookProgress={null}
      onShowCommitProgress={undefined}
      commitToAmend={null}
      placeholder={props.placeholder ?? 'Commit selected changes'}
      prepopulateCommitSummary={props.prepopulateCommitSummary ?? false}
      showBranchProtected={false}
      repoRulesInfo={new RepoRulesInfo()}
      aheadBehind={{ ahead: 0, behind: 0 }}
      showNoWriteAccess={false}
      showCoAuthoredBy={props.showCoAuthoredBy ?? false}
      coAuthors={props.coAuthors ?? []}
      commitSpellcheckEnabled={true}
      showCommitLengthWarning={true}
      mostRecentLocalCommit={null}
      onCoAuthorsUpdated={() => {}}
      onShowCoAuthoredByChanged={() => {}}
      onConfirmCommitWithUnknownCoAuthors={
        props.onConfirmCommitWithUnknownCoAuthors ?? (() => {})
      }
      onCommitMessageFocusSet={() => {}}
      onRefreshAuthor={() => {}}
      onShowPopup={() => {}}
      onShowFoldout={() => {}}
      onCommitSpellcheckEnabledChanged={() => {}}
      onStopAmending={() => {}}
      onShowCreateForkDialog={() => {}}
      accounts={[createAccount()]}
      hasCommitHooks={false}
      skipCommitHooks={false}
      onUpdateCommitOptions={() => {}}
    />
  )

  return {
    ...rendered,
    onCreateCommitCalls,
  }
}

describe('CommitMessage', () => {
  it('requires a summary before enabling commit and submits updated summary and description', () => {
    const { container, unmount: u, onCreateCommitCalls } = renderCommitMessage()
    unmount = u

    const submitButton = queryOrThrow<HTMLButtonElement>(
      container,
      '.commit-button'
    )
    assert.equal(submitButton.disabled, true)

    change(
      queryOrThrow<HTMLInputElement>(container, 'input.summary-field'),
      'Ship commit coverage'
    )
    changeTextArea(
      queryOrThrow<HTMLTextAreaElement>(
        container,
        'textarea.description-field'
      ),
      'Exercise direct component behavior'
    )

    assert.equal(submitButton.disabled, false)
    click(submitButton)

    assert.deepEqual(onCreateCommitCalls, [
      {
        summary: 'Ship commit coverage',
        description: 'Exercise direct component behavior',
        trailers: [],
        amend: false,
        messageGeneratedByCopilot: false,
      },
    ])
  })

  it('uses the placeholder summary when prepopulation is enabled', () => {
    const {
      container,
      unmount: u,
      onCreateCommitCalls,
    } = renderCommitMessage({
      prepopulateCommitSummary: true,
      placeholder: 'Commit selected files',
    })
    unmount = u

    const submitButton = queryOrThrow<HTMLButtonElement>(
      container,
      '.commit-button'
    )
    assert.equal(submitButton.disabled, false)

    click(submitButton)

    assert.deepEqual(onCreateCommitCalls, [
      {
        summary: 'Commit selected files',
        description: '',
        trailers: [],
        amend: false,
        messageGeneratedByCopilot: false,
      },
    ])
  })

  it('confirms unknown co-authors before committing and only includes known co-author trailers', () => {
    const onCreateCommitCalls = new Array<ICommitContext>()
    const confirmationCalls = new Array<ReadonlyArray<UnknownAuthor>>()
    let continueCommit: (() => void) | null = null

    const { container, unmount: u } = renderCommitMessage({
      showCoAuthoredBy: true,
      coAuthors: [createKnownAuthor('Mona'), createUnknownAuthor('octocat')],
      onCreateCommit: async context => {
        onCreateCommitCalls.push(context)
        return true
      },
      onConfirmCommitWithUnknownCoAuthors: (authors, onCommitAnyway) => {
        confirmationCalls.push(authors)
        continueCommit = onCommitAnyway
      },
    })
    unmount = u

    change(
      queryOrThrow<HTMLInputElement>(container, 'input.summary-field'),
      'Add trailer coverage'
    )
    click(queryOrThrow<HTMLButtonElement>(container, '.commit-button'))

    assert.equal(onCreateCommitCalls.length, 0)
    assert.deepEqual(confirmationCalls, [[createUnknownAuthor('octocat')]])

    continueCommit?.()

    assert.deepEqual(onCreateCommitCalls, [
      {
        summary: 'Add trailer coverage',
        description: '',
        trailers: [
          { token: 'Co-Authored-By', value: 'Mona <mona@example.com>' },
        ],
        amend: false,
        messageGeneratedByCopilot: false,
      },
    ])
  })
})
