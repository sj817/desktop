import * as React from 'react'
import { ForkContributionTarget } from '../../models/workflow-preferences'
import { RepositoryWithForkedGitHubRepository } from '../../models/repository'
import { Trans } from 'react-i18next'

interface IForkSettingsDescription {
  readonly repository: RepositoryWithForkedGitHubRepository
  readonly forkContributionTarget: ForkContributionTarget
}

export function ForkSettingsDescription(props: IForkSettingsDescription) {
  // We can't use the getNonForkGitHubRepository() helper since we need to calculate
  // the value based on the temporary form state.
  const targetRepository =
    props.forkContributionTarget === ForkContributionTarget.Self
      ? props.repository.gitHubRepository
      : props.repository.gitHubRepository.parent

  return (
    <ul className="fork-settings-description">
      <li>
        <Trans i18nKey='fork-contribution-target.pull-requests'>
          Pull requests targeting <strong>{targetRepository.fullName}</strong>{' '}
          will be shown in the pull request list.
        </Trans>
      </li>
      <li>
        <Trans i18nKey='fork-contribution-target.issues'>
          Issues will be created in <strong>{targetRepository.fullName}</strong>.
        </Trans>
      </li>
      <li>
        <Trans i18nKey='fork-contribution-target.view-on-github'>
          "View on GitHub" will open <strong>{targetRepository.fullName}</strong>{' '}
          in the browser.
        </Trans>
      </li>
      <li>
        <Trans i18nKey='fork-contribution-target.new-branches'>
          New branches will be based on{' '}
          <strong>{targetRepository.fullName}</strong>'s default branch.
        </Trans>
      </li>
      <li>
        <Trans i18nKey='fork-contribution-target.autocompletion'>
          Autocompletion of user and issues will be based on{' '}
          <strong>{targetRepository.fullName}</strong>.
        </Trans>
      </li>
    </ul>
  )
}
