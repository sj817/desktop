import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Loading } from '../lib/loading'

interface ICopilotConflictResolutionLoadingProps {
  /** Called when the user clicks Cancel to go back to the standard dialog. */
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
 * Loading/error dialog shown while Copilot is analyzing merge conflicts.
 *
 * Renders in the same dialog slot as the conflicts dialog, replacing it
 * while Copilot is working. Shows a spinner with descriptive text and
 * Cancel/Abort buttons, or an error message with Retry if resolution failed.
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
        title={
          <>
            <Octicon symbol={octicons.copilot} className="copilot-icon" />{' '}
            {headerTitle}
          </>
        }
        onDismissed={this.props.onCancel}
        loading={error === null}
        disabled={false}
      >
        <DialogContent>
          {error !== null ? this.renderError(error) : this.renderLoading()}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={error !== null ? 'Retry' : 'Analyzing\u2026'}
            okButtonDisabled={error === null}
            onOkButtonClick={error !== null ? this.props.onRetry : undefined}
            cancelButtonText={abortButton}
            onCancelButtonClick={this.onAbort}
            cancelButtonDisabled={this.state.isAborting}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderLoading(): JSX.Element {
    return (
      <div className="copilot-conflict-loading-content">
        <Loading />
        <p>Copilot is analyzing your conflicts&hellip;</p>
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
