import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { TrashNameLabel } from '../lib/context-menu'
import { RetryAction } from '../../models/retry-actions'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

interface IDiscardChangesRetryDialogProps {
  readonly dispatcher: Dispatcher
  readonly retryAction: RetryAction
  readonly onDismissed: () => void
  readonly onConfirmDiscardChangesChanged: (optOut: boolean) => void
}

interface IDiscardChangesRetryDialogState {
  readonly retrying: boolean
  readonly confirmDiscardChanges: boolean
}

export class DiscardChangesRetryDialog extends React.Component<
  IDiscardChangesRetryDialogProps,
  IDiscardChangesRetryDialogState
> {
  public constructor(props: IDiscardChangesRetryDialogProps) {
    super(props)
    this.state = { retrying: false, confirmDiscardChanges: true }
  }

  public render() {
    const { retrying } = this.state

    return (
      <Dialog
        title={t(
          __DARWIN__
            ? 'Discarded Changes Will Be Unrecoverable'
            : 'Discarded changes will be unrecoverable'
        )}
        id="discard-changes-retry"
        loading={retrying}
        disabled={retrying}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
        type="error"
      >
        <DialogContent>
          <p>
            <Trans i18nKey='discard-changes-retry.failed-to-discard'>
              Failed to discard changes to {{ trashName: TrashNameLabel() }}.
            </Trans>
          </p>
          <div>
            {t('Common reasons are:')}
            <ul>
              <li>
                <Trans i18nKey='discard-changes-retry.deletes-immediately'>
                  The {{ trashName: TrashNameLabel() }} is configured to delete
                  items immediately.
                </Trans>
              </li>
              <li>{t('Restricted access to move the file(s).')}</li>
            </ul>
          </div>
          <p>
            <Trans i18nKey='discard-changes-retry.unrecoverable'>
              These changes will be unrecoverable from the{' '}
              {{ trashName: TrashNameLabel() }}.
            </Trans>
          </p>
          {this.renderConfirmDiscardChanges()}
        </DialogContent>
        {this.renderFooter()}
      </Dialog>
    )
  }

  private renderConfirmDiscardChanges() {
    return (
      <Checkbox
        label={t('Do not show this message again')}
        value={
          this.state.confirmDiscardChanges
            ? CheckboxValue.Off
            : CheckboxValue.On
        }
        onChange={this.onConfirmDiscardChangesChanged}
      />
    )
  }

  private renderFooter() {
    return (
      <DialogFooter>
        <OkCancelButtonGroup
          okButtonText={t(
            __DARWIN__
              ? 'Permanently Discard Changes'
              : 'Permanently discard changes'
          )}
          okButtonTitle={t(
            'This will discard changes and they will be unrecoverable.'
          )}
          cancelButtonText={t('Cancel')}
          destructive={true}
        />
      </DialogFooter>
    )
  }

  private onConfirmDiscardChangesChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = !event.currentTarget.checked

    this.setState({ confirmDiscardChanges: value })
  }

  private onSubmit = async () => {
    const { dispatcher, retryAction } = this.props

    this.setState({ retrying: true })

    await dispatcher.performRetry(retryAction)

    this.props.onConfirmDiscardChangesChanged(this.state.confirmDiscardChanges)
    this.props.onDismissed()
  }
}
