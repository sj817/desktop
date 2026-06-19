import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { t } from '@i18n'

interface IAddSSHHostProps {
  readonly host: string
  readonly ip: string
  readonly keyType: string
  readonly fingerprint: string
  readonly onSubmit: (addHost: boolean) => void
  readonly onDismissed: () => void
}

/**
 * Dialog prompts the user to add a new SSH host as known.
 */
export class AddSSHHost extends React.Component<IAddSSHHostProps> {
  public render() {
    return (
      <Dialog
        id="add-ssh-host"
        type="normal"
        title={t('SSH Host')}
        backdropDismissable={false}
        onSubmit={this.onSubmit}
        onDismissed={this.onCancel}
      >
        <DialogContent>
          <p>
            {t(
              "The authenticity of host '{{host}} ({{ip}})' can't be established. {{keyType}} key fingerprint is {{fingerprint}}.",
              {
                host: this.props.host,
                ip: this.props.ip,
                keyType: this.props.keyType,
                fingerprint: this.props.fingerprint,
              }
            )}
          </p>
          <p>{t('Are you sure you want to continue connecting?')}</p>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('Yes')}
            cancelButtonText={t('No')}
            onCancelButtonClick={this.onCancel}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private submit(addHost: boolean) {
    const { onSubmit, onDismissed } = this.props

    onSubmit(addHost)
    onDismissed()
  }

  private onSubmit = () => {
    this.submit(true)
  }

  private onCancel = () => {
    this.submit(false)
  }
}
