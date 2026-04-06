import * as React from 'react'
import classNames from 'classnames'

type DiffLineType = 'added' | 'removed' | 'context'

export interface IMockDiffLine {
  readonly type: DiffLineType
  readonly content: string
}

interface ICopilotResolutionDiffPreviewProps {
  readonly diffLines: ReadonlyArray<IMockDiffLine>
}

/**
 * Simplified diff preview for Copilot conflict resolution.
 *
 * Renders mock diff lines with red/green backgrounds for
 * removed/added lines.
 */
export class CopilotResolutionDiffPreview extends React.Component<ICopilotResolutionDiffPreviewProps> {
  public render() {
    return (
      <div className="copilot-resolution-diff-preview">
        <pre className="diff-content">
          {this.props.diffLines.map((line, index) =>
            this.renderLine(line, index)
          )}
        </pre>
      </div>
    )
  }

  private renderLine(line: IMockDiffLine, index: number) {
    const prefix =
      line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '
    const className = classNames('diff-line', {
      'diff-line-added': line.type === 'added',
      'diff-line-removed': line.type === 'removed',
      'diff-line-context': line.type === 'context',
    })

    return (
      <div key={index} className={className}>
        <span className="diff-line-prefix">{prefix}</span>
        <span className="diff-line-content">{line.content}</span>
      </div>
    )
  }
}
