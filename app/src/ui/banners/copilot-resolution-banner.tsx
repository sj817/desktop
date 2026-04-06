import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Banner } from './banner'
import { LinkButton } from '../lib/link-button'

interface ICopilotResolutionBannerProps {
  /** Number of conflicts that were resolved by Copilot */
  readonly conflictsResolved: number
  /** Number of files that contained conflicts */
  readonly filesResolved: number
  /** Callback to undo all Copilot resolutions */
  readonly onUndoAll: () => void
  /** Callback to view the resolution summary */
  readonly onViewSummary: () => void
  readonly onDismissed: () => void
}

/**
 * Banner shown after Copilot resolves merge conflicts, prompting the user
 * to review the changes in the diff viewer before committing.
 */
export class CopilotResolutionBanner extends React.Component<
  ICopilotResolutionBannerProps,
  {}
> {
  private onUndoAll = () => {
    this.props.onUndoAll()
  }

  private onViewSummary = () => {
    this.props.onViewSummary()
  }

  public render() {
    const { conflictsResolved, filesResolved } = this.props
    const conflictText =
      conflictsResolved === 1 ? '1 conflict' : `${conflictsResolved} conflicts`
    const fileText = filesResolved === 1 ? '1 file' : `${filesResolved} files`

    return (
      <Banner
        id="copilot-resolution-banner"
        dismissable={false}
        onDismissed={this.props.onDismissed}
      >
        <Octicon className="copilot-icon" symbol={octicons.copilot} />
        <div className="banner-message">
          <span>
            Copilot resolved <strong>{conflictText}</strong> across {fileText}.
            Review changes above, then commit.
          </span>
          <LinkButton onClick={this.onUndoAll}>Undo All</LinkButton>
          <LinkButton onClick={this.onViewSummary}>View Summary</LinkButton>
        </div>
      </Banner>
    )
  }
}
