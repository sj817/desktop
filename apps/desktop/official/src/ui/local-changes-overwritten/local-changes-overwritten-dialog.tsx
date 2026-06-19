import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DefaultDialogFooter,
} from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Repository } from '../../models/repository'
import { RetryAction, RetryActionType } from '../../models/retry-actions'
import { Dispatcher } from '../dispatcher'
import { PathText } from '../lib/path-text'
import { assertNever } from '../../lib/fatal-error'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

interface ILocalChangesOverwrittenDialogProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  /**
   * Whether there's already a stash entry for the local branch.
   */
  readonly hasExistingStash: boolean
  /**
   * The action that should get executed if the user selects "Stash and Continue".
   */
  readonly retryAction: RetryAction
  /**
   * Callback to use when the dialog gets closed.
   */
  readonly onDismissed: () => void

  /**
   * The files that prevented the operation from completing, i.e. the files
   * that would be overwritten.
   */
  readonly files: ReadonlyArray<string>
}
interface ILocalChangesOverwrittenDialogState {
  readonly stashing: boolean
}

export class LocalChangesOverwrittenDialog extends React.Component<
  ILocalChangesOverwrittenDialogProps,
  ILocalChangesOverwrittenDialogState
> {
  public constructor(props: ILocalChangesOverwrittenDialogProps) {
    super(props)
    this.state = { stashing: false }
  }

  public render() {
    const overwrittenText =
      this.props.files.length > 0
        ? t(' The following files would be overwritten:')
        : null
    const retryActionName = this.getRetryActionName()

    return (
      <Dialog
        title={t('Error')}
        id="local-changes-overwritten"
        loading={this.state.stashing}
        disabled={this.state.stashing}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
        type="error"
        role="alertdialog"
        ariaDescribedBy="local-changes-error-description"
      >
        <DialogContent>
          <div id="local-changes-error-description">
            <p>
              <Trans i18nKey='local-changes-overwritten.unable-to-action'>
                Unable to {{ retryActionName }} when changes are present on your
                branch.
              </Trans>
              {overwrittenText}
            </p>
            {this.renderFiles()}
            {this.renderStashText()}
          </div>
        </DialogContent>
        {this.renderFooter()}
      </Dialog>
    )
  }

  private renderFiles() {
    const { files } = this.props
    if (files.length === 0) {
      return null
    }

    return (
      <div className="files-list">
        <ul>
          {files.map(fileName => (
            <li key={fileName}>
              <PathText path={fileName} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  private get canStashChanges() {
    return (
      !this.props.hasExistingStash &&
      !this.state.stashing &&
      this.props.retryAction.type !== RetryActionType.PopStash
    )
  }

  private renderStashText() {
    if (!this.canStashChanges) {
      return null
    }

    return (
      <p>
        {t('You can stash your changes now and recover them afterwards.')}
      </p>
    )
  }

  private renderFooter() {
    if (!this.canStashChanges) {
      return <DefaultDialogFooter />
    }

    return (
      <DialogFooter>
        <OkCancelButtonGroup
          okButtonText={t(
            __DARWIN__
              ? 'Stash Changes and Continue'
              : 'Stash changes and continue'
          )}
          okButtonTitle={t(
            'This will create a stash with your current changes. You can recover them by restoring the stash afterwards.'
          )}
          cancelButtonText={t('Close')}
        />
      </DialogFooter>
    )
  }

  private onSubmit = async () => {
    const { hasExistingStash, repository, dispatcher, retryAction } = this.props

    if (hasExistingStash) {
      // When there's an existing stash we don't let the user stash the changes
      // and we only show a "Close" button on the modal. In that case, the
      // "Close" button submits the dialog and should only dismiss it.
      this.props.onDismissed()
      return
    }

    this.setState({ stashing: true })

    // We know that there's no stash for the current branch so we can safely
    // tell createStashForCurrentBranch not to show a confirmation dialog which
    // would disrupt the async flow (since you can't await a dialog).
    const createdStash = await dispatcher.createStashForCurrentBranch(
      repository,
      false
    )

    this.props.onDismissed()

    if (createdStash) {
      await dispatcher.performRetry(retryAction)
    }
  }

  /**
   * Returns a user-friendly string to describe the current retryAction.
   */
  private getRetryActionName() {
    switch (this.props.retryAction.type) {
      case RetryActionType.Checkout:
        return t('checkout')
      case RetryActionType.Pull:
        return t('pull')
      case RetryActionType.Merge:
        return t('merge')
      case RetryActionType.Rebase:
        return t('rebase')
      case RetryActionType.Clone:
        return t('clone')
      case RetryActionType.Fetch:
        return t('fetch')
      case RetryActionType.Push:
        return t('push')
      case RetryActionType.CherryPick:
      case RetryActionType.CreateBranchForCherryPick:
        return t('cherry-pick')
      case RetryActionType.Squash:
        return t('squash')
      case RetryActionType.Reorder:
        return t('reorder')
      case RetryActionType.DiscardChanges:
        return t('discard changes')
      case RetryActionType.PopStash:
        return t('restore stashed changes')
      default:
        assertNever(
          this.props.retryAction,
          `Unknown retryAction: ${this.props.retryAction}`
        )
    }
  }
}
