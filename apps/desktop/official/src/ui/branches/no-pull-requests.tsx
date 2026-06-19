import * as React from 'react'
import { encodePathAsUrl } from '../../lib/path'
import { Ref } from '../lib/ref'
import { LinkButton } from '../lib/link-button'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

const BlankSlateImage = encodePathAsUrl(
  __dirname,
  'static/empty-no-pull-requests.svg'
)

interface INoPullRequestsProps {
  /** The name of the repository. */
  readonly repositoryName: string

  /** Is the default branch currently checked out? */
  readonly isOnDefaultBranch: boolean

  /** Is this component being rendered due to a search? */
  readonly isSearch: boolean

  /* Called when the user wants to create a new branch. */
  readonly onCreateBranch: () => void

  /** Called when the user wants to create a pull request. */
  readonly onCreatePullRequest: () => void

  /** Are we currently loading pull requests? */
  readonly isLoadingPullRequests: boolean
}

/** The placeholder for when there are no open pull requests. */
export class NoPullRequests extends React.Component<INoPullRequestsProps, {}> {
  public render() {
    return (
      <div className="no-pull-requests">
        <img src={BlankSlateImage} className="blankslate-image" alt="" />
        {this.renderTitle()}
        {this.renderCallToAction()}
      </div>
    )
  }

  private renderTitle() {
    if (this.props.isSearch) {
      return (
        <div className="title">
          {t("Sorry, I can't find that pull request!")}
        </div>
      )
    } else if (this.props.isLoadingPullRequests) {
      return <div className="title">{t('Hang tight')}</div>
    } else {
      return (
        <div>
          <div className="title">{t("You're all set!")}</div>
          <div className="no-prs">
            <Trans i18nKey='no-pull-requests.no-open-prs'>
              No open pull requests in{' '}
              <Ref>{{ repositoryName: this.props.repositoryName }}</Ref>
            </Trans>
          </div>
        </div>
      )
    }
  }

  private renderCallToAction() {
    if (this.props.isLoadingPullRequests) {
      return (
        <div className="call-to-action">
          {t('Loading pull requests as fast as I can!')}
        </div>
      )
    }

    if (this.props.isOnDefaultBranch) {
      return (
        <div className="call-to-action">
          <Trans i18nKey='no-pull-requests.create-branch-cta'>
            Would you like to{' '}
            <LinkButton onClick={this.props.onCreateBranch}>
              create a new branch
            </LinkButton>{' '}
            and get going on your next project?
          </Trans>
        </div>
      )
    } else {
      return (
        <div className="call-to-action">
          <Trans i18nKey='no-pull-requests.create-pr-cta'>
            Would you like to{' '}
            <LinkButton onClick={this.props.onCreatePullRequest}>
              create a pull request
            </LinkButton>{' '}
            from the current branch?
          </Trans>
        </div>
      )
    }
  }
}
