import * as React from 'react'
import { t } from '@i18n'
import { Dialog, DialogContent, DialogFooter } from '../../dialog'
import { OkCancelButtonGroup } from '../../dialog/ok-cancel-button-group'

interface IConfirmAbortDialogProps {
  /**
   * This is expected to be capitalized for correct output on windows and macOs.
   *
   * Examples:
   *  - Rebase
   *  - Cherry-pick
   *  - Squash
   */
  readonly operation: string
  readonly onReturnToConflicts: () => void
  readonly onConfirmAbort: () => Promise<void>
}

interface IConfirmAbortDialogState {
  readonly isAborting: boolean
}

export class ConfirmAbortDialog extends React.Component<
  IConfirmAbortDialogProps,
  IConfirmAbortDialogState
> {
  public constructor(props: IConfirmAbortDialogProps) {
    super(props)
    this.state = {
      isAborting: false,
    }
  }

  private onSubmit = async () => {
    this.setState({
      isAborting: true,
    })

    await this.props.onConfirmAbort()

    this.setState({
      isAborting: false,
    })
  }

  private onCancel = async () => {
    return this.props.onReturnToConflicts()
  }

  public render() {
    const { operation } = this.props
    return (
      <Dialog
        id="abort-warning"
        title={
          __DARWIN__
            ? t('Confirm Abort {{operation}}', { operation })
            : t('Confirm abort {{operation}}', {
                operation: operation.toLowerCase(),
              })
        }
        onDismissed={this.onCancel}
        onSubmit={this.onSubmit}
        disabled={this.state.isAborting}
        type="warning"
        role="alertdialog"
        ariaDescribedBy="abort-operation-confirmation"
      >
        <DialogContent>
          <div className="column-left" id="abort-operation-confirmation">
            <p>
              {t('Are you sure you want to abort this {{operation}}?', {
                operation: operation.toLowerCase(),
              })}
            </p>
            <p>
              {t(
                'This will take you back to the original branch state and the conflicts you have already resolved will be discarded.'
              )}
            </p>
          </div>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={
              __DARWIN__
                ? t('Abort {{operation}}', { operation })
                : t('Abort {{operation}}', {
                    operation: operation.toLowerCase(),
                  })
            }
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
