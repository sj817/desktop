import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

export enum MarkdownViewMode {
  Code = 'code',
  RichDiff = 'rich-diff',
}

interface IMarkdownViewToggleProps {
  readonly viewMode: MarkdownViewMode
  readonly onViewModeChanged: (mode: MarkdownViewMode) => void
}

/**
 * A toggle button for switching between code and rich diff view for markdown files.
 */
export class MarkdownViewToggle extends React.Component<
  IMarkdownViewToggleProps,
  {}
> {
  private onCodeViewClick = () => {
    this.props.onViewModeChanged(MarkdownViewMode.Code)
  }

  private onRichDiffViewClick = () => {
    this.props.onViewModeChanged(MarkdownViewMode.RichDiff)
  }

  public render() {
    const { viewMode } = this.props

    return (
      <div className="markdown-view-toggle" role="group" aria-label="Markdown view mode">
        <button
          className={`markdown-view-toggle-button ${
            viewMode === MarkdownViewMode.Code ? 'active' : ''
          }`}
          onClick={this.onCodeViewClick}
          aria-label="Code view"
          aria-pressed={viewMode === MarkdownViewMode.Code}
          title="Code view"
        >
          <Octicon symbol={octicons.code} />
        </button>
        <button
          className={`markdown-view-toggle-button ${
            viewMode === MarkdownViewMode.RichDiff ? 'active' : ''
          }`}
          onClick={this.onRichDiffViewClick}
          aria-label="Rich diff view"
          aria-pressed={viewMode === MarkdownViewMode.RichDiff}
          title="Rich diff view"
        >
          <Octicon symbol={octicons.file} />
        </button>
      </div>
    )
  }
}
