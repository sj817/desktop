import * as React from 'react'
import { assertNever } from '../../lib/fatal-error'
import { Repository } from '../../models/repository'
import { WorkingDirectoryStatus } from '../../models/status'
import { Dispatcher } from '../dispatcher'
import { getResolvedFiles } from '../../lib/status'
import { ConflictState, IMultiCommitOperationState } from '../../lib/app-state'
import { Branch } from '../../models/branch'
import { MultiCommitOperationStepKind } from '../../models/multi-commit-operation'
import { ConflictsDialog } from './dialog/conflicts-dialog'
import { ConfirmAbortDialog } from './dialog/confirm-abort-dialog'
import { ProgressDialog } from './dialog/progress-dialog'
import { WarnForcePushDialog } from './dialog/warn-force-push-dialog'
import { PopupType } from '../../models/popup'
import { Account } from '../../models/account'
import { IAPIRepoRuleset } from '../../lib/api'
import { Emoji } from '../../lib/emoji'
import {
  CopilotConflictResolutionDialog,
  CopilotConflictResolutionLoading,
} from '../copilot-conflict-resolution'

export interface IMultiCommitOperationProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher

  /** The current state of the multi commit operation */
  readonly state: IMultiCommitOperationState

  /** The current state of conflicts in the app */
  readonly conflictState: ConflictState | null

  /** The emoji map for showing commit emoji's */
  readonly emoji: Map<string, Emoji>

  /** The current state of the working directory */
  readonly workingDirectory: WorkingDirectoryStatus

  /** Whether user should be warned about force pushing */
  readonly askForConfirmationOnForcePush: boolean

  // react/no-unused-prop-types doesn't understand abstract classes and
  // thinks these are unused but they are used in the subclasses.
  // eslint-disable-next-line react/no-unused-prop-types
  readonly accounts: ReadonlyArray<Account>

  // eslint-disable-next-line react/no-unused-prop-types
  readonly cachedRepoRulesets: ReadonlyMap<number, IAPIRepoRuleset>

  /**
   * Callbacks for the conflict selection components to let the user jump out
   * to their preferred editor.
   */
  readonly openFileInExternalEditor: (path: string) => void
  readonly resolvedExternalEditor: string | null
  readonly openRepositoryInShell: (repository: Repository) => void

  /** Whether to always resolve conflicts with Copilot automatically */
  // eslint-disable-next-line react/no-unused-prop-types
  readonly alwaysResolveCopilotConflicts: boolean
}

/** A base component for the shared logic of multi commit operations. */
export abstract class BaseMultiCommitOperation extends React.Component<IMultiCommitOperationProps> {
  protected abstract onBeginOperation: () => void
  protected abstract onChooseBranch: (targetBranch: Branch) => void
  protected abstract onContinueAfterConflicts: () => Promise<void>
  protected abstract onAbort: () => Promise<void>
  protected abstract onConflictsDialogDismissed: () => void
  protected abstract renderChooseBranch: () => JSX.Element | null
  protected abstract renderCreateBranch: () => JSX.Element | null

  /**
   * Override in subclasses that support Copilot conflict resolution (Merge).
   * Returns a callback to initiate Copilot resolution, or undefined if not
   * supported for this operation type.
   */
  protected getOnResolveWithCopilot(): (() => void) | undefined {
    return undefined
  }

  protected onFlowEnded = () => {
    this.props.dispatcher.closePopup(PopupType.MultiCommitOperation)
    this.props.dispatcher.endMultiCommitOperation(this.props.repository)
  }

  /**
   * Method to call anytime we do state type checking that should pass but is
   * needed for typing purposes. Thus it should never happen, so throw error if
   * does.
   */
  protected endFlowInvalidState(isSilent: boolean = false): void {
    const { step, operationDetail } = this.props.state
    const errorMessage = `[${operationDetail.kind}] - Invalid state - ${operationDetail.kind} ended during ${step.kind}.`
    if (isSilent) {
      this.onFlowEnded()
      log.error(errorMessage)
      return
    }
    throw new Error(errorMessage)
  }

  protected onInvokeConflictsDialogDismissed = (operationPrefix: string) => {
    const { repository, dispatcher, state } = this.props
    const { targetBranch, step } = state

    if (step.kind !== MultiCommitOperationStepKind.ShowConflicts) {
      this.endFlowInvalidState()
      return
    }

    const { conflictState } = step
    dispatcher.setMultiCommitOperationStep(repository, {
      kind: MultiCommitOperationStepKind.HideConflicts,
      conflictState,
    })

    const operationDescription = (
      <>
        {operationPrefix}{' '}
        {targetBranch !== null ? <strong>{targetBranch.name}</strong> : null}
      </>
    )

    this.props.dispatcher.closePopup(PopupType.MultiCommitOperation)
    return dispatcher.onConflictsFoundBanner(
      repository,
      operationDescription,
      conflictState
    )
  }

  private onConfirmingAbort = async (): Promise<void> => {
    const { repository, dispatcher, workingDirectory, state } = this.props
    const { userHasResolvedConflicts, step } = state

    if (step.kind !== MultiCommitOperationStepKind.ShowConflicts) {
      this.endFlowInvalidState()
      return
    }

    const { conflictState } = step
    const resolvedConflicts = getResolvedFiles(
      workingDirectory,
      conflictState.manualResolutions
    )

    if (userHasResolvedConflicts || resolvedConflicts.length > 0) {
      dispatcher.setMultiCommitOperationStep(repository, {
        kind: MultiCommitOperationStepKind.ConfirmAbort,
        conflictState,
      })
      return
    }

    return this.onAbort()
  }

  private moveToConflictState = () => {
    const { dispatcher, repository, state } = this.props
    const { step } = state
    if (step.kind !== MultiCommitOperationStepKind.ConfirmAbort) {
      this.endFlowInvalidState()
      return
    }

    const { conflictState } = step
    return dispatcher.setMultiCommitOperationStep(repository, {
      kind: MultiCommitOperationStepKind.ShowConflicts,
      conflictState,
    })
  }

  private setConflictsHaveBeenResolved = () => {
    this.props.dispatcher.setConflictsResolved(this.props.repository)
  }

  private onCancelCopilotMode = () => {
    const { dispatcher, repository } = this.props
    dispatcher.setCopilotConflictResolutionState(repository, undefined)
  }

  private onRetryCopilotResolution = () => {
    const { dispatcher, repository } = this.props
    dispatcher.startCopilotConflictResolution(repository)
  }

  public render() {
    const { state } = this.props
    const { step } = state

    switch (step.kind) {
      case MultiCommitOperationStepKind.ChooseBranch: {
        return this.renderChooseBranch()
      }
      case MultiCommitOperationStepKind.ShowProgress:
        const { emoji } = this.props
        return (
          <ProgressDialog
            progress={state.progress}
            emoji={emoji}
            operation={state.operationDetail.kind}
          />
        )
      case MultiCommitOperationStepKind.ShowConflicts: {
        const {
          repository,
          resolvedExternalEditor,
          openFileInExternalEditor,
          openRepositoryInShell,
          dispatcher,
          workingDirectory,
          state,
          alwaysResolveCopilotConflicts,
        } = this.props

        const { userHasResolvedConflicts, operationDetail } = state
        const { manualResolutions, ourBranch, theirBranch } = step.conflictState
        const copilotState = step.copilotConflictResolutionState

        const operation = __DARWIN__
          ? operationDetail.kind
          : operationDetail.kind.toLowerCase()
        const submit = `Continue ${operation}`
        const abort = `Abort ${operation}`
        const headerTitle = `Resolve conflicts before ${operationDetail.kind}`

        // Copilot loading state — show loading dialog
        if (copilotState !== undefined && copilotState.kind === 'loading') {
          return (
            <CopilotConflictResolutionLoading
              headerTitle={headerTitle}
              abortButton={abort}
              error={null}
              onCancel={this.onCancelCopilotMode}
              onRetry={this.onRetryCopilotResolution}
              onAbort={this.onAbort}
            />
          )
        }

        // Copilot error state — show loading dialog with error
        if (copilotState !== undefined && copilotState.kind === 'error') {
          return (
            <CopilotConflictResolutionLoading
              headerTitle={headerTitle}
              abortButton={abort}
              error={copilotState.error}
              onCancel={this.onCancelCopilotMode}
              onRetry={this.onRetryCopilotResolution}
              onAbort={this.onAbort}
            />
          )
        }

        // Copilot ready state — show Copilot resolution dialog
        if (copilotState !== undefined && copilotState.kind === 'ready') {
          return (
            <CopilotConflictResolutionDialog
              dispatcher={dispatcher}
              repository={repository}
              workingDirectory={workingDirectory}
              userHasResolvedConflicts={userHasResolvedConflicts}
              resolvedExternalEditor={resolvedExternalEditor}
              ourBranch={ourBranch}
              theirBranch={theirBranch}
              manualResolutions={manualResolutions}
              headerTitle={headerTitle}
              submitButton={submit}
              abortButton={abort}
              onSubmit={this.onContinueAfterConflicts}
              onAbort={this.onConfirmingAbort}
              onDismissed={this.onConflictsDialogDismissed}
              openFileInExternalEditor={openFileInExternalEditor}
              openRepositoryInShell={openRepositoryInShell}
              someConflictsHaveBeenResolved={this.setConflictsHaveBeenResolved}
              copilotResponse={copilotState.response}
              acceptedCopilotResolutions={copilotState.acceptedFiles}
              alwaysResolveCopilotConflicts={alwaysResolveCopilotConflicts}
              onExitCopilotMode={this.onCancelCopilotMode}
            />
          )
        }

        // Default: standard conflicts dialog
        return (
          <ConflictsDialog
            dispatcher={dispatcher}
            repository={repository}
            workingDirectory={workingDirectory}
            userHasResolvedConflicts={userHasResolvedConflicts}
            resolvedExternalEditor={resolvedExternalEditor}
            ourBranch={ourBranch}
            theirBranch={theirBranch}
            manualResolutions={manualResolutions}
            headerTitle={headerTitle}
            submitButton={submit}
            abortButton={abort}
            onSubmit={this.onContinueAfterConflicts}
            onAbort={this.onConfirmingAbort}
            onDismissed={this.onConflictsDialogDismissed}
            openFileInExternalEditor={openFileInExternalEditor}
            openRepositoryInShell={openRepositoryInShell}
            someConflictsHaveBeenResolved={this.setConflictsHaveBeenResolved}
            onResolveWithCopilot={this.getOnResolveWithCopilot()}
          />
        )
      }
      case MultiCommitOperationStepKind.ConfirmAbort:
        return (
          <ConfirmAbortDialog
            operation={this.props.state.operationDetail.kind}
            onConfirmAbort={this.onAbort}
            onReturnToConflicts={this.moveToConflictState}
          />
        )
      case MultiCommitOperationStepKind.WarnForcePush:
        const { dispatcher, askForConfirmationOnForcePush } = this.props
        return (
          <WarnForcePushDialog
            operation={state.operationDetail.kind}
            dispatcher={dispatcher}
            askForConfirmationOnForcePush={askForConfirmationOnForcePush}
            onBegin={this.onBeginOperation}
            onDismissed={this.onFlowEnded}
          />
        )
      case MultiCommitOperationStepKind.CreateBranch:
        return this.renderCreateBranch()
      case MultiCommitOperationStepKind.HideConflicts:
        return null
      default:
        return assertNever(
          step,
          `Unknown multi commit operation step found: ${step}`
        )
    }
  }
}
