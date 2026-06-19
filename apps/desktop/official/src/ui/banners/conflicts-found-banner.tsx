import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Banner } from './banner'
import { LinkButton } from '../lib/link-button'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

interface IConflictsFoundBannerProps {
  /**
   * Description of the operation to continue
   * Examples:
   *  - rebasing <strong>target-branch-name</strong>
   *  - cherry-picking onto <strong>target-branch-name</strong>
   *  - squashing commits on <strong>target-branch-name</strong>
   */
  readonly operationDescription: string | JSX.Element
  /** Callback to fire when the dialog should be reopened */
  readonly onOpenConflictsDialog: () => void
  /** Callback to fire to dismiss the banner */
  readonly onDismissed: () => void
}

export class ConflictsFoundBanner extends React.Component<
  IConflictsFoundBannerProps,
  {}
> {
  private openDialog = async () => {
    this.props.onDismissed()
    this.props.onOpenConflictsDialog()
  }

  private onDismissed = () => {
    log.warn(
      `[ConflictsBanner] This cannot be dismissed by default unless the user clicks on the link`
    )
  }

  public render() {
    return (
      <Banner
        id="conflicts-found-banner"
        dismissable={false}
        onDismissed={this.onDismissed}
      >
        <Octicon className="alert-icon" symbol={octicons.alert} />
        <div className="banner-message">
          <span>
            <Trans i18nKey='conflicts-found.banner'>
              Resolve conflicts to continue {this.props.operationDescription}.
            </Trans>
          </span>
          <LinkButton onClick={this.openDialog}>{t('View conflicts')}</LinkButton>
        </div>
      </Banner>
    )
  }
}
