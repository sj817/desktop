import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Loading } from '../lib/loading'

interface ICopilotConflictResolutionLoadingProps {
  /** Called when the user clicks Cancel to abort the resolution request. */
  readonly onDismissed: () => void

  /** Optional error message to display instead of the loading state. */
  readonly error: string | null
}

/**
 * A simple loading dialog shown while Copilot is analyzing merge conflicts.
 *
 * Displays a spinner with descriptive text and a Cancel button, or an error
 * message if the resolution request failed.
 */
export class CopilotConflictResolutionLoading extends React.Component<ICopilotConflictResolutionLoadingProps> {
  public render() {
    const { error } = this.props

    return (
      <Dialog
        id="copilot-conflict-resolution-loading"
        title={this.renderTitle()}
        onDismissed={this.props.onDismissed}
        loading={error === null}
        disabled={false}
      >
        <DialogContent>
          {error !== null ? this.renderError(error) : this.renderLoading()}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={error !== null ? 'Retry' : undefined}
            okButtonDisabled={error === null}
            cancelButtonText="Cancel"
            onCancelButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderTitle() {
    return (
      <>
        <Octicon symbol={octicons.copilot} className="copilot-icon" />
        {' Copilot Conflict Resolution'}
      </>
    )
  }

  private renderLoading(): JSX.Element {
    return (
      <div className="copilot-conflict-loading-content">
        <Loading />
        <p>Copilot is analyzing your conflicts…</p>
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
