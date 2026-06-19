import * as React from 'react'
import { APICheckConclusion } from '../../lib/api'
import { IRefCheck } from '../../lib/ci-checks/ci-checks'
import { IMenuItem, showContextualMenu } from '../../lib/menu-item'
import { Button } from '../lib/button'
import { Octicon, syncClockwise } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

interface ICICheckReRunButtonProps {
  readonly disabled: boolean
  readonly checkRuns: ReadonlyArray<IRefCheck>
  readonly canReRunFailed: boolean
  readonly onRerunChecks: (failedOnly: boolean) => void
}

export class CICheckReRunButton extends React.PureComponent<ICICheckReRunButtonProps> {
  private get failedChecksExist() {
    return this.props.checkRuns.some(
      cr => cr.conclusion === APICheckConclusion.Failure
    )
  }

  private onRerunChecks = () => {
    if (!this.props.canReRunFailed || !this.failedChecksExist) {
      this.props.onRerunChecks(false)
      return
    }

    const items: IMenuItem[] = [
      {
        label: t(
          __DARWIN__ ? 'Re-run Failed Checks' : 'Re-run failed checks'
        ),
        action: () => this.props.onRerunChecks(true),
      },
      {
        label: t(__DARWIN__ ? 'Re-run All Checks' : 'Re-run all checks'),
        action: () => this.props.onRerunChecks(false),
      },
    ]

    showContextualMenu(items)
  }

  private onRerunKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!this.props.canReRunFailed || !this.failedChecksExist) {
      return
    }

    if (event.key === 'ArrowDown') {
      this.onRerunChecks()
    }
  }

  public render() {
    const text =
      this.props.canReRunFailed && this.failedChecksExist ? (
        <Trans i18nKey='ci-check-re-run-button.re-run-with-menu'>
          Re-run <Octicon symbol={octicons.triangleDown} />
        </Trans>
      ) : (
        t('Re-run Checks')
      )
    return (
      <Button
        onClick={this.onRerunChecks}
        onKeyDown={this.onRerunKeyDown}
        disabled={this.props.disabled}
      >
        <Octicon symbol={syncClockwise} /> {text}
      </Button>
    )
  }
}
