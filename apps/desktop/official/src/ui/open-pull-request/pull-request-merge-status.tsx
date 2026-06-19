import * as React from 'react'
import { Trans } from 'react-i18next'
import { assertNever } from '../../lib/fatal-error'
import { ComputedAction } from '../../models/computed-action'
import { MergeTreeResult } from '../../models/merge'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IPullRequestMergeStatusProps {
  /** The result of merging the pull request branch into the base branch */
  readonly mergeStatus: MergeTreeResult | null
}

/** The component to display message about the result of merging the pull
 * request. */
export class PullRequestMergeStatus extends React.Component<IPullRequestMergeStatusProps> {
  private getMergeStatusDescription = () => {
    const { mergeStatus } = this.props
    if (mergeStatus === null) {
      return ''
    }

    const { kind } = mergeStatus
    switch (kind) {
      case ComputedAction.Loading:
        return (
          <span className="pr-merge-status-loading">
            <Trans i18nKey='pull-request-merge-status.loading'>
              <strong>Checking mergeability&hellip;</strong> Don’t worry, you can
              still create the pull request.
            </Trans>
          </span>
        )
      case ComputedAction.Invalid:
        return (
          <span className="pr-merge-status-invalid">
            <Trans i18nKey='pull-request-merge-status.invalid'>
              <strong>Error checking merge status.</strong> Unable to merge
              unrelated histories in this repository
            </Trans>
          </span>
        )
      case ComputedAction.Clean:
        return (
          <span className="pr-merge-status-clean">
            <Trans i18nKey='pull-request-merge-status.clean'>
              <strong>
                <Octicon symbol={octicons.check} /> Able to merge.
              </strong>{' '}
              These branches can be automatically merged.
            </Trans>
          </span>
        )
      case ComputedAction.Conflicts:
        return (
          <span className="pr-merge-status-conflicts">
            <Trans i18nKey='pull-request-merge-status.conflicts'>
              <strong>
                <Octicon symbol={octicons.x} /> Can't automatically merge.
              </strong>{' '}
              Don’t worry, you can still create the pull request.
            </Trans>
          </span>
        )
      default:
        return assertNever(kind, `Unknown merge status kind of ${kind}.`)
    }
  }

  public render() {
    return (
      <div className="pull-request-merge-status">
        {this.getMergeStatusDescription()}
      </div>
    )
  }
}
