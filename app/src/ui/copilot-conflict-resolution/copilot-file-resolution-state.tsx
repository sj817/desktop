import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { PathText } from '../lib/path-text'
import { Button } from '../lib/button'

interface ICopilotFileResolutionStateProps {
  /** The relative file path */
  readonly path: string
  /** A brief summary of how Copilot resolved the conflict */
  readonly summary: string
  /** Callback to undo the Copilot resolution */
  readonly onUndo: (path: string) => void
}

/**
 * Renders a file row for a conflict that has been resolved by Copilot.
 *
 * Displays the file path with a Copilot icon, a one-line resolution summary,
 * an undo button, and a green checkmark indicating resolution.
 */
export class CopilotFileResolutionState extends React.Component<ICopilotFileResolutionStateProps> {
  private onUndoClick = () => {
    this.props.onUndo(this.props.path)
  }

  public render() {
    return (
      <li
        key={this.props.path}
        className="unmerged-file-status-resolved copilot-resolved-file"
      >
        <Octicon
          symbol={octicons.copilot}
          className="file-octicon copilot-icon"
        />
        <div className="column-left" id={this.props.path}>
          <PathText path={this.props.path} />
          <div className="file-conflicts-status copilot-resolution-summary">
            {this.props.summary}
          </div>
        </div>
        <Button
          className="undo-button"
          onClick={this.onUndoClick}
          ariaDescribedBy={this.props.path}
        >
          Undo
        </Button>
        <div className="green-circle">
          <Octicon symbol={octicons.check} />
        </div>
      </li>
    )
  }
}
