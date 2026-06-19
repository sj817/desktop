import * as React from 'react'
import { t } from '@i18n'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Trans } from 'react-i18next'

interface IAttributeMismatchProps {
  /** Called when the dialog should be dismissed. */
  readonly onDismissed: () => void

  /** Called when the user has chosen to replace the update filters. */
  readonly onUpdateExistingFilters: () => void

  readonly onEditGlobalGitConfig: () => void
}

export class AttributeMismatch extends React.Component<IAttributeMismatchProps> {
  public render() {
    return (
      <Dialog
        id="lfs-attribute-mismatch"
        title={t(
          __DARWIN__
            ? 'Update Existing Git LFS Filters?'
            : 'Update existing Git LFS filters?'
        )}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
      >
        <DialogContent>
          <p>
            <Trans i18nKey='attribute-mismatch.filters-configured'>
              Git LFS filters are already configured in{' '}
              <LinkButton onClick={this.props.onEditGlobalGitConfig}>
                your global git config
              </LinkButton>{' '}
              but are not the values it expects. Would you like to update them
              now?
            </Trans>
          </p>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t(
              __DARWIN__ ? 'Update Existing Filters' : 'Update existing filters'
            )}
            cancelButtonText={t(__DARWIN__ ? 'Not Now' : 'Not now')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSubmit = () => {
    this.props.onUpdateExistingFilters()
    this.props.onDismissed()
  }
}
