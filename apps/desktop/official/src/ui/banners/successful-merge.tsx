import * as React from 'react'
import { Trans } from 'react-i18next'
import { SuccessBanner } from './success-banner'

export function SuccessfulMerge({
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
        <Trans i18nKey='successful-merge.with-their-branch'>
          {'Successfully merged '}
          <strong>{theirBranch}</strong>
          {' into '}
          <strong>{ourBranch}</strong>
        </Trans>
      </span>
    ) : (
      <span>
        <Trans i18nKey='successful-merge.message'>
          {'Successfully merged into '}
          <strong>{ourBranch}</strong>
        </Trans>
      </span>
    )

  return (
    <SuccessBanner timeout={5000} onDismissed={onDismissed}>
      <div className="banner-message">{message}</div>
    </SuccessBanner>
  )
}
