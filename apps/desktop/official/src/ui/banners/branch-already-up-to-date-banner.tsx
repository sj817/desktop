import * as React from 'react'
import { Trans } from 'react-i18next'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Banner } from './banner'

export function BranchAlreadyUpToDate({
  ourBranch,
  theirBranch,
  onDismissed,
}: {
  readonly ourBranch: string
  readonly theirBranch?: string
  readonly onDismissed: () => void
}) {
  const message =
    theirBranch !== undefined ? (
      <span>
        <Trans i18nKey='branch-already-up-to-date.with-their-branch'>
          <strong>{ourBranch}</strong>
          {' is already up to date with '}
          <strong>{theirBranch}</strong>
        </Trans>
      </span>
    ) : (
      <span>
        <Trans i18nKey='branch-already-up-to-date.message'>
          <strong>{ourBranch}</strong>
          {' is already up to date'}
        </Trans>
      </span>
    )

  return (
    <Banner id="successful-merge" timeout={5000} onDismissed={onDismissed}>
      <div className="green-circle">
        <Octicon className="check-icon" symbol={octicons.check} />
      </div>
      <div className="banner-message">{message}</div>
    </Banner>
  )
}
