import * as React from 'react'
import { t } from '@i18n'
import { Dialog, DialogContent, DefaultDialogFooter } from '../dialog'
import { InstalledCLIPath } from '../lib/install-cli'
import { Trans } from 'react-i18next'

interface ICLIInstalledProps {
  /** Called when the popup should be dismissed. */
  readonly onDismissed: () => void
}

/** Tell the user the CLI tool was successfully installed. */
export class CLIInstalled extends React.Component<ICLIInstalledProps, {}> {
  public render() {
    return (
      <Dialog
        title={t(
          __DARWIN__
            ? 'Command Line Tool Installed'
            : 'Command line tool installed'
        )}
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          <div>
            <Trans i18nKey='cli-installed.installed-at'>
              The command line tool has been installed at{' '}
              <strong>{{ path: InstalledCLIPath }}</strong>.
            </Trans>
          </div>
        </DialogContent>
        <DefaultDialogFooter buttonText={t('Ok')} />
      </Dialog>
    )
  }
}
