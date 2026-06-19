import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Banner } from './banner'
import { Dispatcher } from '../dispatcher'
import { LinkButton } from '../lib/link-button'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

interface IRebaseConflictsBannerProps {
  readonly dispatcher: Dispatcher
  /** branch the user is rebasing into */
  readonly targetBranch: string
  /** callback to fire when the dialog should be reopened */
  readonly onOpenDialog: () => void
  /** callback to fire to dismiss the banner */
  readonly onDismissed: () => void
}

export class RebaseConflictsBanner extends React.Component<
  IRebaseConflictsBannerProps,
  {}
> {
  private openDialog = async () => {
    this.props.onDismissed()
    this.props.onOpenDialog()
    this.props.dispatcher.incrementMetric('rebaseConflictsDialogReopenedCount')
  }

  private onDismissed = () => {
    log.warn(
      `[RebaseConflictsBanner] this is not dismissable by default unless the user clicks on the link`
    )
  }

  public render() {
    return (
      <Banner
        id="rebase-conflicts-banner"
        dismissable={false}
        onDismissed={this.onDismissed}
      >
        <Octicon className="alert-icon" symbol={octicons.alert} />
        <div className="banner-message">
          <span>
            <Trans i18nKey='rebase-conflicts.banner'>
              Resolve conflicts to continue rebasing{' '}
              <strong>{{ targetBranch: this.props.targetBranch }}</strong>.
            </Trans>
          </span>
          <LinkButton onClick={this.openDialog}>{t('View conflicts')}</LinkButton>
        </div>
      </Banner>
    )
  }
}
