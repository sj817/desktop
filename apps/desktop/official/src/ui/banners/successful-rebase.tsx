import * as React from 'react'
import { Trans } from 'react-i18next'
import { SuccessBanner } from './success-banner'

export function SuccessfulRebase({
  baseBranch,
  targetBranch,
  onDismissed,
}: {
  readonly baseBranch?: string
  readonly targetBranch: string
  readonly onDismissed: () => void
}) {
  const message =
    baseBranch !== undefined ? (
      <span>
        <Trans i18nKey='successful-rebase.with-base-branch'>
          {'Successfully rebased '}
          <strong>{targetBranch}</strong>
          {' onto '}
          <strong>{baseBranch}</strong>
        </Trans>
      </span>
    ) : (
      <span>
        <Trans i18nKey='successful-rebase.message'>
          {'Successfully rebased '}
          <strong>{targetBranch}</strong>
        </Trans>
      </span>
    )

  return (
    <SuccessBanner timeout={5000} onDismissed={onDismissed}>
      <div className="banner-message">{message}</div>
    </SuccessBanner>
  )
}
