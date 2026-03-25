import { afterEach, before, describe, it, mock } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'

import { Account } from '../../../src/models/account'
import { Author, UnknownAuthor } from '../../../src/models/author'
import { IAheadBehind } from '../../../src/models/branch'
import { ICommitContext } from '../../../src/models/commit'
import { DefaultCommitMessage } from '../../../src/models/commit-message'
import { GitHubRepository } from '../../../src/models/github-repository'
import { Owner } from '../../../src/models/owner'
import { PopupType } from '../../../src/models/popup'
import { RepoRulesInfo } from '../../../src/models/repo-rules'
import { Repository } from '../../../src/models/repository'
import { FoldoutType } from '../../../src/lib/app-state'
import { Dispatcher } from '../../../src/ui/dispatcher'
import type { ICommitMessageProps } from '../../../src/ui/changes/commit-message'
import {
  change,
  click,
  queryByTextOrThrow,
  queryOrThrow,
  renderComponent,
} from '../../helpers/component-test-utils'

type CommitMessageDialogType =
  typeof import('../../../src/ui/commit-message/commit-message-dialog').CommitMessageDialog

let latestCommitMessageProps: ICommitMessageProps | null = null
let CommitMessageDialog: CommitMessageDialogType
let unmount: (() => void) | undefined

mock.module('../../../src/ui/changes/commit-message', {
  namedExports: {
    CommitMessage: (props: ICommitMessageProps) => {
      latestCommitMessageProps = props
      const [summary, setSummary] = React.useState(
        props.commitMessage?.summary ?? ''
      )
      const [description, setDescription] = React.useState(
        props.commitMessage?.description ?? ''
      )

      return (
        <div className="mock-commit-message">
          <div className="commit-button-text">{props.commitButtonText}</div>
          <div className="show-coauthors">{String(props.showCoAuthoredBy)}</div>
          <div className="coauthor-count">{props.coAuthors.length}</div>
          <div className="spellcheck-enabled">
            {String(props.commitSpellcheckEnabled)}
          </div>
          <input
            className="commit-summary"
            value={summary}
            onChange={event => setSummary(event.currentTarget.value)}
          />
          <textarea
            className="commit-description"
            value={description}
            onChange={event => setDescription(event.currentTarget.value)}
          />
          <button
            type="button"
            className="submit-commit-message"
            onClick={() =>
              props.onCreateCommit({
                summary,
                description,
              })
            }
          >
            {props.commitButtonText}
          </button>
          <button
            type="button"
            className="toggle-coauthors"
            onClick={() =>
              props.onShowCoAuthoredByChanged(!props.showCoAuthoredBy)
            }
          >
            Toggle Coauthors
          </button>
          <button
            type="button"
            className="update-coauthors"
            onClick={() =>
              props.onCoAuthorsUpdated([
                {
                  kind: 'known',
                  name: 'Mona Lisa',
                  email: 'mona@example.com',
                  username: 'mona',
                },
              ])
            }
          >
            Update Coauthors
          </button>
          <button
            type="button"
            className="confirm-unknown-authors"
            onClick={() =>
              props.onConfirmCommitWithUnknownCoAuthors(
                [{ kind: 'unknown', username: 'octocat', state: 'error' }],
                () => {}
              )
            }
          >
            Confirm Unknown Authors
          </button>
          <button
            type="button"
            className="refresh-author"
            onClick={() => props.onRefreshAuthor()}
          >
            Refresh Author
          </button>
          <button
            type="button"
            className="show-popup"
            onClick={() => props.onShowPopup({ type: PopupType.AddRepository })}
          >
            Show Popup
          </button>
          <button
            type="button"
            className="show-foldout"
            onClick={() =>
              props.onShowFoldout({ type: FoldoutType.Repository })
            }
          >
            Show Foldout
          </button>
          <button
            type="button"
            className="toggle-spellcheck"
            onClick={() => props.onCommitSpellcheckEnabledChanged(false)}
          >
            Toggle Spellcheck
          </button>
          <button
            type="button"
            className="stop-amending"
            onClick={() => props.onStopAmending()}
          >
            Stop Amending
          </button>
          <button
            type="button"
            className="show-create-fork"
            onClick={() => props.onShowCreateForkDialog()}
          >
            Show Create Fork
          </button>
          <button
            type="button"
            className="create-commit"
            onClick={() =>
              props.onCreateCommit({
                summary: 'Ship it',
                description: 'Wrapper test',
              })
            }
          >
            Create Commit
          </button>
        </div>
      )
    },
  },
})

before(async () => {
  ;({ CommitMessageDialog } = await import(
    '../../../src/ui/commit-message/commit-message-dialog'
  ))
})

afterEach(() => {
  unmount?.()
  unmount = undefined
  latestCommitMessageProps = null
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

function renderCommitMessageDialog(
  props: {
    repository?: Repository
    coAuthors?: ReadonlyArray<Author>
    showCoAuthoredBy?: boolean
    commitSpellcheckEnabled?: boolean
    onSubmitCommitMessage?: (context: ICommitContext) => Promise<boolean>
    dispatcherOverrides?: Partial<Dispatcher>
  } = {}
) {
  const repository = props.repository ?? createRepository()
  const calls = new Array<string>()
  const dispatcher = Object.create(Dispatcher.prototype) as Dispatcher
  Object.assign(dispatcher, {
    showUnknownAuthorsCommitWarning: (
      authors: ReadonlyArray<UnknownAuthor>
    ) => {
      calls.push(`unknown:${authors.length}`)
    },
    refreshAuthor: (repo: Repository) => {
      assert.equal(repo, repository)
      calls.push('refresh')
    },
    showPopup: (popup: { type: PopupType }) => {
      calls.push(`popup:${popup.type}`)
    },
    showFoldout: (foldout: { type: FoldoutType }) => {
      calls.push(`foldout:${foldout.type}`)
    },
    setCommitSpellcheckEnabled: (enabled: boolean) => {
      calls.push(`spellcheck:${enabled}`)
    },
    stopAmendingRepository: (repo: Repository) => {
      assert.equal(repo, repository)
      calls.push('stop-amending')
    },
    showCreateForkDialog: (repo: Repository) => {
      assert.equal(repo, repository)
      calls.push('fork')
    },
    ...props.dispatcherOverrides,
  })

  const submitCalls = new Array<ICommitContext>()
  const rendered = renderComponent(
    <CommitMessageDialog
      autocompletionProviders={[]}
      branch="main"
      coAuthors={props.coAuthors ?? [createKnownAuthor('Alex')]}
      commitAuthor={null}
      commitMessage={DefaultCommitMessage}
      commitSpellcheckEnabled={props.commitSpellcheckEnabled ?? true}
      showCommitLengthWarning={true}
      dialogButtonText="Commit Now"
      dialogTitle="Commit Changes"
      dispatcher={dispatcher}
      prepopulateCommitSummary={false}
      repository={repository}
      showBranchProtected={false}
      repoRulesInfo={new RepoRulesInfo()}
      aheadBehind={{ ahead: 1, behind: 0 } as IAheadBehind}
      showCoAuthoredBy={props.showCoAuthoredBy ?? true}
      showNoWriteAccess={false}
      onDismissed={() => {
        calls.push('dismiss')
      }}
      onSubmitCommitMessage={
        props.onSubmitCommitMessage ??
        (async context => {
          submitCalls.push(context)
          return true
        })
      }
      repositoryAccount={createAccount()}
      accounts={[createAccount()]}
      hasCommitHooks={true}
      skipCommitHooks={false}
      signOffCommits={false}
      allowEmptyCommit={false}
      onUpdateCommitOptions={() => {
        calls.push('update-options')
      }}
    />
  )

  return { ...rendered, calls, submitCalls, repository }
}

describe('CommitMessageDialog', () => {
  it('renders the dialog title and forwards the expected wrapper props', () => {
    const { container, unmount: u } = renderCommitMessageDialog()
    unmount = u

    queryByTextOrThrow(container, 'h1', 'Commit Changes')
    queryByTextOrThrow(container, '.commit-button-text', 'Commit Now')
    queryByTextOrThrow(container, '.show-coauthors', 'true')
    queryByTextOrThrow(container, '.coauthor-count', '1')
    queryByTextOrThrow(container, '.spellcheck-enabled', 'true')
  })

  it('updates the dialog-managed coauthor state through child callbacks', () => {
    const { container, unmount: u } = renderCommitMessageDialog({
      showCoAuthoredBy: false,
      coAuthors: [],
    })
    unmount = u

    click(queryOrThrow<HTMLButtonElement>(container, '.toggle-coauthors'))
    click(queryOrThrow<HTMLButtonElement>(container, '.update-coauthors'))

    assert.equal(latestCommitMessageProps?.showCoAuthoredBy, true)
    assert.equal(latestCommitMessageProps?.coAuthors.length, 1)
    queryByTextOrThrow(container, '.show-coauthors', 'true')
    queryByTextOrThrow(container, '.coauthor-count', '1')
  })

  it('routes child callbacks through the dispatcher and submit handler', () => {
    const {
      container,
      unmount: u,
      calls,
      submitCalls,
    } = renderCommitMessageDialog()
    unmount = u

    click(
      queryOrThrow<HTMLButtonElement>(container, '.confirm-unknown-authors')
    )
    click(queryOrThrow<HTMLButtonElement>(container, '.refresh-author'))
    click(queryOrThrow<HTMLButtonElement>(container, '.show-popup'))
    click(queryOrThrow<HTMLButtonElement>(container, '.show-foldout'))
    click(queryOrThrow<HTMLButtonElement>(container, '.toggle-spellcheck'))
    click(queryOrThrow<HTMLButtonElement>(container, '.stop-amending'))
    click(queryOrThrow<HTMLButtonElement>(container, '.show-create-fork'))
    click(queryOrThrow<HTMLButtonElement>(container, '.create-commit'))

    assert.deepEqual(calls, [
      'unknown:1',
      'refresh',
      `popup:${PopupType.AddRepository}`,
      `foldout:${FoldoutType.Repository}`,
      'spellcheck:false',
      'stop-amending',
      'fork',
    ])
    assert.deepEqual(submitCalls, [
      { summary: 'Ship it', description: 'Wrapper test' },
    ])
  })

  it('submits through a more realistic child form path', async () => {
    const {
      container,
      unmount: u,
      submitCalls,
    } = renderCommitMessageDialog()
    unmount = u

    change(
      queryOrThrow<HTMLInputElement>(container, 'input.commit-summary'),
      'Ship dialog coverage'
    )
    change(
      queryOrThrow<HTMLTextAreaElement>(container, 'textarea.commit-description'),
      'Exercise the child form path'
    )

    click(queryOrThrow<HTMLButtonElement>(container, '.submit-commit-message'))

    await Promise.resolve()

    assert.deepEqual(submitCalls, [
      {
        summary: 'Ship dialog coverage',
        description: 'Exercise the child form path',
      },
    ])
  })

  it('only opens the create fork dialog for repositories with a GitHub repository', () => {
    const {
      container,
      unmount: u,
      calls,
    } = renderCommitMessageDialog({
      repository: createRepository(false),
    })
    unmount = u

    click(queryOrThrow<HTMLButtonElement>(container, '.show-create-fork'))

    assert.deepEqual(calls, [])
  })
})
