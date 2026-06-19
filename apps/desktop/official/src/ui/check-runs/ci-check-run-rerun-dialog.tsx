import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { IRefCheck } from '../../lib/ci-checks/ci-checks'
import { CICheckRunList } from './ci-check-run-list'
import { GitHubRepository } from '../../models/github-repository'
import { Dispatcher } from '../dispatcher'
import {
  APICheckConclusion,
  APICheckStatus,
  IAPICheckSuite,
} from '../../lib/api'
import { Octicon } from '../octicons'
import * as octicons from './../octicons/octicons.generated'
import { encodePathAsUrl } from '../../lib/path'
import { offsetFromNow } from '../../lib/offset-from'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

const BlankSlateImage = encodePathAsUrl(
  __dirname,
  'static/empty-no-pull-requests.svg'
)

interface ICICheckRunRerunDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: GitHubRepository

  /** List of all the check runs (some of which are not rerunnable) */
  readonly checkRuns: ReadonlyArray<IRefCheck>

  /** The git reference of the pr */
  readonly prRef: string

  /** Whether to only rerun failed checks */
  readonly failedOnly: boolean

  readonly onDismissed: () => void
}

interface ICICheckRunRerunDialogState {
  readonly loadingCheckSuites: boolean
  readonly loadingRerun: boolean
  readonly rerunnable: ReadonlyArray<IRefCheck>
  readonly nonRerunnable: ReadonlyArray<IRefCheck>
}

/**
 * Dialog that informs the user of which jobs will be rerun
 */
export class CICheckRunRerunDialog extends React.Component<
  ICICheckRunRerunDialogProps,
  ICICheckRunRerunDialogState
> {
  public constructor(props: ICICheckRunRerunDialogProps) {
    super(props)
    this.state = {
      loadingCheckSuites: true,
      loadingRerun: false,
      rerunnable: [],
      nonRerunnable: [],
    }
    this.determineRerunnability()
  }

  private onSubmit = async () => {
    const { dispatcher, repository, prRef } = this.props
    this.setState({ loadingRerun: true })
    await dispatcher.rerequestCheckSuites(
      repository,
      this.state.rerunnable,
      this.props.failedOnly
    )
    await dispatcher.manualRefreshSubscription(
      repository,
      prRef,
      this.state.rerunnable
    )
    dispatcher.incrementMetric('rerunsChecks')
    this.props.onDismissed()
  }

  private determineRerunnability = async () => {
    const checkRunsToConsider = this.props.failedOnly
      ? this.props.checkRuns.filter(
          cr => cr.conclusion === APICheckConclusion.Failure
        )
      : this.props.checkRuns

    // Get unique set of check suite ids
    const checkSuiteIds = new Set(
      checkRunsToConsider.map(cr => cr.checkSuiteId)
    )

    const checkSuitesPromises = new Array<Promise<IAPICheckSuite | null>>()

    for (const id of checkSuiteIds) {
      if (id === null) {
        continue
      }
      checkSuitesPromises.push(
        this.props.dispatcher.fetchCheckSuite(this.props.repository, id)
      )
    }

    const rerequestableCheckSuiteIds: number[] = []
    for (const cs of await Promise.all(checkSuitesPromises)) {
      if (cs === null) {
        continue
      }

      const createdAt = Date.parse(cs.created_at)
      if (
        cs.rerequestable &&
        createdAt > offsetFromNow(-30, 'days') && // Must be less than a month old
        cs.status === APICheckStatus.Completed // Must be completed
      ) {
        rerequestableCheckSuiteIds.push(cs.id)
      }
    }

    const rerunnable = checkRunsToConsider.filter(
      cr =>
        cr.checkSuiteId !== null &&
        rerequestableCheckSuiteIds.includes(cr.checkSuiteId)
    )
    const nonRerunnable = checkRunsToConsider.filter(
      cr =>
        cr.checkSuiteId === null ||
        !rerequestableCheckSuiteIds.includes(cr.checkSuiteId)
    )

    this.setState({ loadingCheckSuites: false, rerunnable, nonRerunnable })
  }

  private renderRerunnableJobsList = () => {
    if (this.state.rerunnable.length === 0) {
      return null
    }

    return (
      <div className="ci-check-run-list check-run-rerun-list">
        <CICheckRunList
          checkRuns={this.state.rerunnable}
          notExpandable={true}
          isCondensedView={true}
          hasStatusTooltip={true}
        />
      </div>
    )
  }

  private renderRerunDependentsMessage = () => {
    if (this.state.rerunnable.length === 0) {
      return null
    }

    if (this.props.checkRuns.length === 1) {
      return (
        <div className="re-run-dependents-message">
          <Trans i18nKey='ci-check-run-rerun-dialog.dependents-message-single'>
            A new attempt of{' '}
            <strong>{{ name: this.props.checkRuns[0].name }}</strong> will be
            started, including all of its dependents:
          </Trans>
        </div>
      )
    }

    return (
      <div className="re-run-dependents-message">
        {t(
          'A new attempt of these workflows will be started, including all of their dependents:'
        )}
      </div>
    )
  }

  private renderRerunWarning = () => {
    if (
      this.state.loadingCheckSuites ||
      this.state.nonRerunnable.length === 0
    ) {
      return null
    }

    const nonRerunnableCount = this.state.nonRerunnable.length
    const isSingle = nonRerunnableCount === 1
    const warningPrefix =
      this.state.rerunnable.length === 0
        ? this.props.failedOnly
          ? t('There are no failed checks that can be re-run')
          : t('There are no checks that can be re-run')
        : this.props.failedOnly
        ? isSingle
          ? t('There is {{count}} failed check that cannot be re-run', {
              count: nonRerunnableCount,
            })
          : t('There are {{count}} failed checks that cannot be re-run', {
              count: nonRerunnableCount,
            })
        : isSingle
        ? t('There is {{count}} check that cannot be re-run', {
            count: nonRerunnableCount,
          })
        : t('There are {{count}} checks that cannot be re-run', {
            count: nonRerunnableCount,
          })
    return (
      <div className="non-re-run-info warning-helper-text">
        <Octicon symbol={octicons.alert} />

        {t(
          '{{warningPrefix}}. A check run cannot be re-run if the check is more than one month old, the check or its dependent has not completed, or the check is not configured to be re-run.',
          { warningPrefix }
        )}
      </div>
    )
  }

  public getTitle = (showDescriptor: boolean = true) => {
    const { checkRuns, failedOnly } = this.props
    const isSingle = checkRuns.length === 1

    if (showDescriptor && failedOnly) {
      return isSingle
        ? t(__DARWIN__ ? 'Re-run Failed Check' : 'Re-run failed check')
        : t(__DARWIN__ ? 'Re-run Failed Checks' : 'Re-run failed checks')
    }

    if (showDescriptor && isSingle) {
      return t(__DARWIN__ ? 'Re-run Single Check' : 'Re-run single check')
    }

    return isSingle
      ? t(__DARWIN__ ? 'Re-run Check' : 'Re-run check')
      : t(__DARWIN__ ? 'Re-run Checks' : 'Re-run checks')
  }

  private renderDialogContent = () => {
    if (this.state.loadingCheckSuites && this.props.checkRuns.length > 1) {
      return (
        <div className="loading-rerun-checks">
          <img src={BlankSlateImage} className="blankslate-image" alt="" />
          <div className="title">{t('Please wait')}</div>
          <div className="call-to-action">
            {t('Determining which checks can be re-run.')}
          </div>
        </div>
      )
    }

    return (
      <>
        {this.renderRerunDependentsMessage()}
        {this.renderRerunnableJobsList()}
        {this.renderRerunWarning()}
      </>
    )
  }

  public render() {
    return (
      <Dialog
        id="rerun-check-runs"
        title={this.getTitle()}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        loading={this.state.loadingCheckSuites || this.state.loadingRerun}
      >
        <DialogContent>{this.renderDialogContent()}</DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={this.getTitle(false)}
            okButtonDisabled={this.state.rerunnable.length === 0}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
