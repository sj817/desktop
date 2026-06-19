import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Ref } from '../lib/ref'
import { IBYOKProvider } from '../../lib/copilot/byok'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

interface IConfirmDeleteCopilotBYOKProviderDialogProps {
  readonly provider: IBYOKProvider
  readonly onConfirm: (provider: IBYOKProvider) => void
  readonly onDismissed: () => void
}

/**
 * Confirmation prompt shown before removing a BYOK Copilot provider. The
 * provider is removed from local storage and any stored secret is purged
 * from the OS keychain.
 */
export class ConfirmDeleteCopilotBYOKProviderDialog extends React.Component<IConfirmDeleteCopilotBYOKProviderDialogProps> {
  public render() {
    return (
      <Dialog
        id="confirm-delete-copilot-byok-provider"
        title={t(
          __DARWIN__ ? 'Remove Custom Provider' : 'Remove custom provider'
        )}
        type="warning"
        onSubmit={this.onConfirm}
        onDismissed={this.props.onDismissed}
        role="alertdialog"
        ariaDescribedBy="confirm-delete-copilot-byok-provider-message"
      >
        <DialogContent>
          <p id="confirm-delete-copilot-byok-provider-message">
            <Trans i18nKey='confirm-delete-byok-provider.message'>
              Are you sure you want to remove the custom provider{' '}
              <Ref>{{ name: this.props.provider.name }}</Ref>?{' '}
              {this.renderSecretConsequence()}
            </Trans>
          </p>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={t(__DARWIN__ ? 'Remove' : 'Remove')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderSecretConsequence() {
    switch (this.props.provider.authKind) {
      case 'apiKey':
        return t('Its API key will also be removed from your keychain.')
      case 'bearer':
        return t('Its bearer token will also be removed from your keychain.')
      case 'none':
        return t(
          'Any models you have configured for it will no longer be available.'
        )
    }
  }

  private onConfirm = () => {
    this.props.onConfirm(this.props.provider)
    this.props.onDismissed()
  }
}
