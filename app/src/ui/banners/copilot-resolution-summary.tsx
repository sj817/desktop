import * as React from 'react'
import { Dialog, DialogContent } from '../dialog'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface ICopilotResolutionSummaryFile {
  readonly path: string
  readonly reasoning: string
}

interface ICopilotResolutionSummaryProps {
  readonly resolvedFiles: ReadonlyArray<ICopilotResolutionSummaryFile>
  readonly onDismissed: () => void
}

/**
 * Dialog showing a summary of what Copilot did to resolve each conflicted file.
 */
export class CopilotResolutionSummary extends React.Component<
  ICopilotResolutionSummaryProps,
  {}
> {
  public render() {
    return (
      <Dialog
        id="copilot-resolution-summary"
        title="Copilot Resolution Summary"
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          <p className="copilot-summary-description">
            <Octicon className="copilot-icon" symbol={octicons.copilot} />
            Copilot resolved {this.props.resolvedFiles.length} conflicted{' '}
            {this.props.resolvedFiles.length === 1 ? 'file' : 'files'}:
          </p>
          <ul className="copilot-resolution-file-list">
            {this.props.resolvedFiles.map(file => (
              <li key={file.path}>
                <code>{file.path}</code>
                <span className="copilot-resolution-reasoning">
                  {' '}
                  — {file.reasoning}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    )
  }
}
