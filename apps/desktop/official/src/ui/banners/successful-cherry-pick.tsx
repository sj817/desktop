import * as React from 'react'
import { Trans } from 'react-i18next'
import { SuccessBanner } from './success-banner'

interface ISuccessfulCherryPickBannerProps {
  readonly targetBranchName: string
  readonly countCherryPicked: number
  readonly onDismissed: () => void
  readonly onUndo: () => void
}

export class SuccessfulCherryPick extends React.Component<
  ISuccessfulCherryPickBannerProps,
  {}
> {
  public render() {
    const { countCherryPicked, onDismissed, onUndo, targetBranchName } =
      this.props

    const pluralized = countCherryPicked === 1 ? 'commit' : 'commits'

    return (
      <SuccessBanner timeout={15000} onDismissed={onDismissed} onUndo={onUndo}>
        <span>
          <Trans i18nKey='successful-cherry-pick.banner'>
            Successfully copied {{ countCherryPicked }} {{ pluralized }} to{' '}
            <strong>{{ targetBranchName }}</strong>.
          </Trans>
        </span>
      </SuccessBanner>
    )
  }
}
