import * as React from 'react'
import classNames from 'classnames'
import {
  Octicon,
  check,
  triangleDown,
  triangleRight,
  fileCode,
} from '../octicons'
import { Button } from '../lib/button'
import {
  CopilotResolutionDiffPreview,
  IMockDiffLine,
} from './copilot-resolution-diff-preview'

export type FileResolutionStatus = 'pending' | 'accepted'

interface ICopilotResolutionFileCardProps {
  readonly filePath: string
  readonly summary: string
  readonly reasoning: string
  readonly diffLines: ReadonlyArray<IMockDiffLine>
  readonly status: FileResolutionStatus
  readonly onAccept: () => void
  readonly onUndo: () => void
}

interface ICopilotResolutionFileCardState {
  readonly isPreviewExpanded: boolean
}

/**
 * A card representing a single file's Copilot-resolved conflict.
 *
 * Shows the file path, resolution summary, accept/undo buttons,
 * and a collapsible diff preview with reasoning.
 */
export class CopilotResolutionFileCard extends React.Component<
  ICopilotResolutionFileCardProps,
  ICopilotResolutionFileCardState
> {
  public constructor(props: ICopilotResolutionFileCardProps) {
    super(props)
    this.state = {
      isPreviewExpanded: false,
    }
  }

  private onTogglePreview = () => {
    this.setState(prev => ({ isPreviewExpanded: !prev.isPreviewExpanded }))
  }

  private onAcceptClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    this.props.onAccept()
  }

  private onUndoClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    this.props.onUndo()
  }

  public render() {
    const { filePath, summary, status } = this.props
    const { isPreviewExpanded } = this.state
    const isAccepted = status === 'accepted'

    const className = classNames('copilot-resolution-file-card', {
      'file-card-accepted': isAccepted,
    })

    return (
      <div className={className}>
        <div className="file-card-header">
          <div className="file-card-info">
            <div className="file-card-path">
              {isAccepted ? (
                <Octicon symbol={check} className="file-card-icon check-icon" />
              ) : (
                <Octicon symbol={fileCode} className="file-card-icon" />
              )}
              <span className="file-path-text">{filePath}</span>
            </div>
            <div className="file-card-summary">{summary}</div>
          </div>
          <div className="file-card-actions">
            {isAccepted ? (
              <Button
                className="undo-button"
                onClick={this.onUndoClick}
                size="small"
              >
                Undo
              </Button>
            ) : (
              <Button
                className="accept-button"
                onClick={this.onAcceptClick}
                size="small"
              >
                Accept
              </Button>
            )}
          </div>
        </div>
        <button
          className="preview-toggle"
          onClick={this.onTogglePreview}
          aria-expanded={isPreviewExpanded}
          type="button"
        >
          <Octicon symbol={isPreviewExpanded ? triangleDown : triangleRight} />
          <span>Preview changes</span>
        </button>
        {isPreviewExpanded && this.renderExpandedPreview()}
      </div>
    )
  }

  private renderExpandedPreview() {
    return (
      <div className="file-card-preview">
        <CopilotResolutionDiffPreview diffLines={this.props.diffLines} />
        <div className="file-card-reasoning">
          <span className="reasoning-icon">💡</span>
          <span className="reasoning-text">{this.props.reasoning}</span>
        </div>
      </div>
    )
  }
}
