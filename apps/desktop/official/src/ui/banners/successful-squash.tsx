import * as React from 'react'
import { SuccessBanner } from './success-banner'
import { t } from '@i18n'

interface ISuccessfulSquashedBannerProps {
  readonly count: number
  readonly onDismissed: () => void
  readonly onUndo: () => void
}

export class SuccessfulSquash extends React.Component<
  ISuccessfulSquashedBannerProps,
  {}
> {
  public render() {
    const { count, onDismissed, onUndo } = this.props

    return (
      <SuccessBanner timeout={15000} onDismissed={onDismissed} onUndo={onUndo}>
        <span>
          {t(
            count === 1
              ? 'Successfully squashed {{count}} commit.'
              : 'Successfully squashed {{count}} commits.',
            { count }
          )}
        </span>
      </SuccessBanner>
    )
  }
}
