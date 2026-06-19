import * as React from 'react'

import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Terminal } from '../terminal'
import { TerminalOutput } from '../../lib/git'
import { t } from '@i18n'

interface IHookFailedProps {
  readonly hookName: string
  readonly terminalOutput: TerminalOutput
  readonly resolve: (value: 'abort' | 'ignore') => void
  readonly onDismissed: () => void
}

/** A component to confirm and then discard changes. */
export class HookFailed extends React.Component<IHookFailedProps> {
  private getDialogTitle() {
    return t(
      __DARWIN__ ? '{{hookName}} Failed' : '{{hookName}} failed',
      { hookName: this.props.hookName }
    )
  }

  private onDismissed = () => {
    this.props.resolve('abort')
    this.props.onDismissed()
  }

  private onIgnore = () => {
    this.props.resolve('ignore')
    this.props.onDismissed()
  }

  public render() {
    return (
      <Dialog
        id="hook-failed-dialog"
        title={this.getDialogTitle()}
        onDismissed={this.onDismissed}
        onSubmit={this.onIgnore}
        type="warning"
        role="alertdialog"
        ariaDescribedBy="hook-failure-message"
      >
        <DialogContent>
          <p id="hook-failure-message">
            {t('The {{hookName}} hook failed. What would you like to do?', {
              hookName: this.props.hookName,
            })}
          </p>
          <Terminal
            terminalOutput={this.props.terminalOutput}
            rows={15}
            cols={80}
          />
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={t('Ignore and Continue')}
            cancelButtonText={t('Abort')}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
