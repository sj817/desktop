import * as React from 'react'
import { Checkbox, CheckboxValue } from '../../lib/checkbox'
import { Dispatcher } from '../../dispatcher'
import { DialogFooter, DialogContent, Dialog } from '../../dialog'
import { OkCancelButtonGroup } from '../../dialog/ok-cancel-button-group'
import { t } from '@i18n'

interface IWarnForcePushProps {
  /**
   * This is expected to be capitalized for correct output on windows and macOs.
   *
   * Examples:
   *  - Rebase
   *  - Squash
   *  - Reorder
   *  - Amend
   */
  readonly operation: string
  readonly dispatcher: Dispatcher
  readonly askForConfirmationOnForcePush: boolean
  readonly onBegin: () => void
  readonly onDismissed: () => void
}

interface IWarnForcePushState {
  readonly askForConfirmationOnForcePush: boolean
}

export class WarnForcePushDialog extends React.Component<
  IWarnForcePushProps,
  IWarnForcePushState
> {
  public constructor(props: IWarnForcePushProps) {
    super(props)

    this.state = {
      askForConfirmationOnForcePush: props.askForConfirmationOnForcePush,
    }
  }

  public render() {
    const { operation, onDismissed } = this.props

    const title = __DARWIN__
      ? t('{{operation}} Will Require Force Push', { operation })
      : t('{{operation}} will require force push', { operation })

    return (
      <Dialog
        title={title}
        onDismissed={onDismissed}
        onSubmit={this.onBegin}
        backdropDismissable={false}
        type="warning"
        role="alertdialog"
        ariaDescribedBy="warn-force-push-confirmation-title warn-force-push-confirmation-message"
      >
        <DialogContent>
          <p id="warn-force-push-confirmation-title">
            {t('Are you sure you want to {{operation}}?', {
              operation: operation.toLowerCase(),
            })}
          </p>
          <p id="warn-force-push-confirmation-message">
            {t(
              'At the end of the {{operation}} flow, GitHub Desktop will enable you to force push the branch to update the upstream branch. Force pushing will alter the history on the remote and potentially cause problems for others collaborating on this branch.',
              { operation: operation.toLowerCase() }
            )}
          </p>
          <div>
            <Checkbox
              label={t('Do not show this message again')}
              value={
                this.state.askForConfirmationOnForcePush
                  ? CheckboxValue.Off
                  : CheckboxValue.On
              }
              onChange={this.onAskForConfirmationOnForcePushChanged}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('Begin {{operation}}', {
              operation: __DARWIN__ ? operation : operation.toLowerCase(),
            })}
            onCancelButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onAskForConfirmationOnForcePushChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = !event.currentTarget.checked

    this.setState({ askForConfirmationOnForcePush: value })
  }

  private onBegin = async () => {
    this.props.dispatcher.setConfirmForcePushSetting(
      this.state.askForConfirmationOnForcePush
    )

    this.props.onBegin()
  }
}
