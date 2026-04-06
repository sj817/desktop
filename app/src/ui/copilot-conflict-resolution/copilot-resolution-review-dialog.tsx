import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { DialogSuccess } from '../dialog/success'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Loading } from '../lib/loading'
import {
  CopilotResolutionFileCard,
  ResolutionChoice,
} from './copilot-resolution-file-card'
import { mockConflictFiles } from './mock-conflict-data'

interface ICopilotResolutionReviewDialogProps {
  readonly onDismissed: () => void
}

interface ICopilotResolutionReviewDialogState {
  readonly isLoading: boolean
  /** Map of file path to the user's resolution choice. */
  readonly choices: ReadonlyMap<string, ResolutionChoice>
}

/** Simulated loading delay in milliseconds. */
const loadingDelayMs = 1500

/**
 * A dialog that presents Copilot's suggested conflict resolutions with
 * a per-file comparison view.
 *
 * Each file card lets the user flip between the original conflict, ours,
 * theirs, and Copilot's merged suggestion so they can understand the
 * choices Copilot made.
 */
export class CopilotResolutionReviewDialog extends React.Component<
  ICopilotResolutionReviewDialogProps,
  ICopilotResolutionReviewDialogState
> {
  private loadingTimer: number | null = null

  public constructor(props: ICopilotResolutionReviewDialogProps) {
    super(props)
    this.state = {
      isLoading: true,
      choices: new Map(),
    }
  }

  public componentDidMount() {
    this.loadingTimer = window.setTimeout(() => {
      this.setState({ isLoading: false })
    }, loadingDelayMs)
  }

  public componentWillUnmount() {
    if (this.loadingTimer !== null) {
      window.clearTimeout(this.loadingTimer)
    }
  }

  public render() {
    return (
      <Dialog
        id="copilot-resolution-review"
        title={this.renderTitle()}
        onDismissed={this.props.onDismissed}
        loading={this.state.isLoading}
        disabled={this.state.isLoading}
      >
        {this.renderBanner()}
        <DialogContent>
          {this.state.isLoading
            ? this.renderLoadingState()
            : this.renderFileCards()}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={this.renderAcceptAllButton()}
            okButtonDisabled={this.state.isLoading || !this.hasPendingFiles()}
            cancelButtonText="Back to Manual"
            onOkButtonClick={this.onAcceptAll}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderTitle(): JSX.Element {
    return (
      <>
        <Octicon symbol={octicons.copilot} className="copilot-title-icon" />
        Copilot Conflict Resolution
      </>
    )
  }

  private renderBanner(): JSX.Element | null {
    if (this.state.isLoading) {
      return null
    }

    const resolvedCount = this.state.choices.size
    const totalCount = mockConflictFiles.length

    if (resolvedCount === 0) {
      return null
    }

    return (
      <DialogSuccess>
        Resolved {resolvedCount} of {totalCount} conflicts
      </DialogSuccess>
    )
  }

  private renderLoadingState(): JSX.Element {
    return (
      <div className="copilot-loading-state">
        <Loading />
        <p>Copilot is analyzing conflicts…</p>
      </div>
    )
  }

  private renderFileCards(): JSX.Element {
    return (
      <div className="copilot-file-card-list">
        {mockConflictFiles.map(file => (
          <CopilotResolutionFileCard
            key={file.path}
            file={file}
            choice={this.state.choices.get(file.path) ?? null}
            onAcceptCopilot={this.onAcceptCopilot}
            onUseOurs={this.onUseOurs}
            onUseTheirs={this.onUseTheirs}
            onUndo={this.onUndo}
          />
        ))}
      </div>
    )
  }

  private renderAcceptAllButton(): JSX.Element {
    return (
      <>
        <Octicon symbol={octicons.copilot} />
        Accept All Copilot Suggestions
      </>
    )
  }

  /** Returns true when at least one file has no resolution chosen yet. */
  private hasPendingFiles(): boolean {
    return this.state.choices.size < mockConflictFiles.length
  }

  private setChoice(path: string, choice: ResolutionChoice) {
    this.setState(prev => {
      const next = new Map(prev.choices)
      next.set(path, choice)
      return { choices: next }
    })
  }

  private removeChoice(path: string) {
    this.setState(prev => {
      const next = new Map(prev.choices)
      next.delete(path)
      return { choices: next }
    })
  }

  private onAcceptCopilot = (path: string) => {
    this.setChoice(path, 'copilot')
  }

  private onUseOurs = (path: string) => {
    this.setChoice(path, 'ours')
  }

  private onUseTheirs = (path: string) => {
    this.setChoice(path, 'theirs')
  }

  private onUndo = (path: string) => {
    this.removeChoice(path)
  }

  private onAcceptAll = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    for (const file of mockConflictFiles) {
      if (!this.state.choices.has(file.path)) {
        this.setChoice(file.path, 'copilot')
      }
    }
  }
}
