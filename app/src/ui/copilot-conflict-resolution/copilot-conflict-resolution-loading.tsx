import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'

interface ICopilotConflictResolutionLoadingProps {
  /** Called when the user clicks Back to return to the standard dialog. */
  readonly onCancel: () => void
  /** Called when the user clicks Retry after an error. */
  readonly onRetry: () => void
  /** Optional error message to display instead of the loading state. */
  readonly error: string | null
  /** Title for the dialog header. */
  readonly headerTitle: string | JSX.Element
  /** Label for the abort button. */
  readonly abortButton: string
  /** Called when user clicks abort. */
  readonly onAbort: () => Promise<void>
}

interface ICopilotConflictResolutionLoadingState {
  readonly isAborting: boolean
}

/**
 * Loading/error state shown while Copilot is analyzing merge conflicts.
 *
 * Renders in the same dialog slot as the conflicts dialog, replacing it
 * while Copilot is working. Shows a centered Copilot icon with "Thinking..."
 * text and Back/Abort buttons, or an error message with Retry.
 */
export class CopilotConflictResolutionLoading extends React.Component<
  ICopilotConflictResolutionLoadingProps,
  ICopilotConflictResolutionLoadingState
> {
  public constructor(props: ICopilotConflictResolutionLoadingProps) {
    super(props)
    this.state = { isAborting: false }
  }

  private onAbort = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    this.setState({ isAborting: true })
    await this.props.onAbort()
    this.setState({ isAborting: false })
  }

  public render() {
    const { error, headerTitle, abortButton } = this.props

    return (
      <Dialog
        id="copilot-conflict-resolution-loading"
        title={headerTitle}
        onDismissed={this.props.onCancel}
        disabled={false}
      >
        <DialogContent>
          {error !== null ? this.renderError(error) : this.renderLoading()}
        </DialogContent>
        <DialogFooter>
          <div className="copilot-loading-footer">
            <Button onClick={this.props.onCancel}>Back</Button>
            {error !== null ? (
              <OkCancelButtonGroup
                okButtonText="Retry"
                onOkButtonClick={this.props.onRetry}
                cancelButtonText={abortButton}
                onCancelButtonClick={this.onAbort}
                cancelButtonDisabled={this.state.isAborting}
              />
            ) : (
              <Button onClick={this.onAbort} disabled={this.state.isAborting}>
                {abortButton}
              </Button>
            )}
          </div>
        </DialogFooter>
      </Dialog>
    )
  }

  private renderLoading(): JSX.Element {
    return (
      <div className="copilot-conflict-loading-content">
        <div className="copilot-thinking">
          <Octicon symbol={octicons.copilot} />
          <span>Thinking&hellip;</span>
        </div>
        <p className="copilot-conflict-loading-description">
          This may take a moment depending on the number and complexity of
          conflicts.
        </p>
      </div>
    )
  }

  private renderError(error: string): JSX.Element {
    return (
      <div className="copilot-conflict-loading-content">
        <Octicon
          symbol={octicons.copilotError}
          className="copilot-error-icon"
        />
        <p>Copilot was unable to resolve the conflicts.</p>
        <p className="copilot-conflict-loading-description">{error}</p>
      </div>
    )
  }
}
