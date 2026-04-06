import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { assertNever } from '../../lib/fatal-error'

type CopilotResolutionState = 'loading' | 'results' | 'error'

interface ICopilotResolvedFile {
  readonly path: string
  readonly summary: string
}

/** Mock data representing files resolved by Copilot */
const mockResolvedFiles: ReadonlyArray<ICopilotResolvedFile> = [
  {
    path: 'src/config.json',
    summary:
      'Kept security settings (SSL, audit logging) and added new dashboard feature.',
  },
  {
    path: 'src/utils.ts',
    summary: 'Combined input sanitization with the new title parameter.',
  },
  {
    path: 'README.md',
    summary: 'Merged documentation sections. Preserved security section.',
  },
]

/** Simulated delay in milliseconds for the mock Copilot resolution */
const simulatedResolutionDelayMs = 2000

interface ICopilotResolutionSummaryDialogProps {
  /** Callback invoked when the dialog is dismissed or user goes back to manual */
  readonly onDismissed: () => void
  /** Callback invoked when the user accepts all Copilot resolutions */
  readonly onAcceptAll: () => void
}

interface ICopilotResolutionSummaryDialogState {
  readonly resolutionState: CopilotResolutionState
  readonly resolvedFiles: ReadonlyArray<ICopilotResolvedFile>
}

/**
 * Dialog showing Copilot's conflict resolution summary.
 *
 * Displays a loading state while Copilot analyzes conflicts, then shows
 * per-file resolution summaries with accept/reject options.
 */
export class CopilotResolutionSummaryDialog extends React.Component<
  ICopilotResolutionSummaryDialogProps,
  ICopilotResolutionSummaryDialogState
> {
  private simulationTimer: number | null = null

  public constructor(props: ICopilotResolutionSummaryDialogProps) {
    super(props)
    this.state = {
      resolutionState: 'loading',
      resolvedFiles: [],
    }
  }

  public componentDidMount() {
    this.simulateResolution()
  }

  public componentWillUnmount() {
    if (this.simulationTimer !== null) {
      window.clearTimeout(this.simulationTimer)
    }
  }

  /**
   * Simulates Copilot analyzing and resolving conflicts.
   * In a real implementation, this would call the Copilot SDK.
   */
  private simulateResolution() {
    this.simulationTimer = window.setTimeout(() => {
      this.setState({
        resolutionState: 'results',
        resolvedFiles: mockResolvedFiles,
      })
      this.simulationTimer = null
    }, simulatedResolutionDelayMs)
  }

  private renderLoading(): JSX.Element {
    return (
      <div className="copilot-resolution-loading">
        <Octicon symbol={octicons.copilot} className="copilot-icon" />
        <p>Copilot is analyzing conflicts…</p>
      </div>
    )
  }

  private renderResults(): JSX.Element {
    const { resolvedFiles } = this.state
    const total = resolvedFiles.length
    return (
      <div className="copilot-resolution-results">
        <div className="resolution-banner">
          <Octicon symbol={octicons.check} className="banner-icon" />
          <span>
            Resolved {total} of {total} conflicts
          </span>
        </div>
        <ul className="resolved-file-list">
          {resolvedFiles.map((file, index) => (
            <li key={index} className="resolved-file-item">
              <div className="resolved-file-header">
                <Octicon symbol={octicons.check} className="file-check-icon" />
                <span className="resolved-file-path">{file.path}</span>
              </div>
              <p className="resolved-file-summary">{file.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  private renderError(): JSX.Element {
    return (
      <div className="copilot-resolution-error">
        <Octicon symbol={octicons.copilotError} className="error-icon" />
        <p>
          Copilot couldn&apos;t resolve these conflicts. Try resolving manually.
        </p>
      </div>
    )
  }

  private renderContent(): JSX.Element {
    const { resolutionState } = this.state
    switch (resolutionState) {
      case 'loading':
        return this.renderLoading()
      case 'results':
        return this.renderResults()
      case 'error':
        return this.renderError()
      default:
        return assertNever(resolutionState, `Unknown resolution state`)
    }
  }

  private renderFooter(): JSX.Element {
    const { resolutionState } = this.state
    switch (resolutionState) {
      case 'loading':
        return (
          <DialogFooter>
            <Button type="button" onClick={this.onBackToManual}>
              Cancel
            </Button>
          </DialogFooter>
        )
      case 'results':
        return (
          <DialogFooter>
            <OkCancelButtonGroup
              okButtonText="Accept All Resolutions"
              cancelButtonText="Back to Manual Resolution"
              onCancelButtonClick={this.onBackToManual}
            />
          </DialogFooter>
        )
      case 'error':
        return (
          <DialogFooter>
            <Button type="button" onClick={this.props.onDismissed}>
              Dismiss
            </Button>
          </DialogFooter>
        )
      default:
        return assertNever(resolutionState, `Unknown resolution state`)
    }
  }

  private onBackToManual = () => {
    this.props.onDismissed()
  }

  public render() {
    const isLoading = this.state.resolutionState === 'loading'
    return (
      <Dialog
        id="copilot-resolution-summary"
        title="Copilot Conflict Resolution"
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onAcceptAll}
        loading={isLoading}
      >
        <DialogContent>{this.renderContent()}</DialogContent>
        {this.renderFooter()}
      </Dialog>
    )
  }
}
