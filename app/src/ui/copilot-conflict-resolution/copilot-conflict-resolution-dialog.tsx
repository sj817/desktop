import * as React from 'react'
import * as Path from 'path'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import {
  ICopilotConflictResolutionResponse,
  IFileResolution,
  ConflictResolutionConfidence,
} from '../../lib/copilot-conflict-resolution'

/** Per-file acceptance status in the review dialog. */
type FileResolutionStatus = 'pending' | 'accepted' | 'rejected'

interface ICopilotConflictResolutionDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly resolutions: ICopilotConflictResolutionResponse
  readonly onDismissed: () => void
}

interface ICopilotConflictResolutionDialogState {
  /** Accept/reject status per file path. */
  readonly fileStatuses: ReadonlyMap<string, FileResolutionStatus>
  /** Which files have their resolved-content preview expanded. */
  readonly expandedFiles: ReadonlySet<string>
  /** Text used to filter the file list by path. */
  readonly filterText: string
  /** Whether we're currently writing accepted resolutions to disk. */
  readonly isApplying: boolean
  /** Error message to display if applying fails. */
  readonly applyError: string | null
}

/**
 * Dialog for reviewing and accepting/rejecting Copilot's conflict resolution
 * suggestions. Shows each conflicted file with its reasoning, confidence level,
 * and an expandable preview of the resolved content.
 */
export class CopilotConflictResolutionDialog extends React.Component<
  ICopilotConflictResolutionDialogProps,
  ICopilotConflictResolutionDialogState
> {
  public constructor(props: ICopilotConflictResolutionDialogProps) {
    super(props)

    const fileStatuses = new Map<string, FileResolutionStatus>()
    for (const resolution of props.resolutions.resolutions) {
      fileStatuses.set(resolution.path, 'pending')
    }

    this.state = {
      fileStatuses,
      expandedFiles: new Set<string>(),
      filterText: '',
      isApplying: false,
      applyError: null,
    }
  }

  public render() {
    const { resolutions } = this.props.resolutions
    const filteredResolutions = this.getFilteredResolutions()
    const acceptedCount = this.getCountByStatus('accepted')
    const rejectedCount = this.getCountByStatus('rejected')
    const pendingCount = this.getCountByStatus('pending')

    return (
      <Dialog
        id="copilot-conflict-resolution-dialog"
        title={this.renderTitle()}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onAcceptAll}
        loading={this.state.isApplying}
        disabled={this.state.isApplying}
        className="copilot-conflict-resolution"
      >
        <DialogContent>
          {this.state.applyError !== null && (
            <div className="copilot-conflict-apply-error">
              <Octicon symbol={octicons.alert} />
              <span>{this.state.applyError}</span>
            </div>
          )}

          <div className="copilot-conflict-summary">
            <span>
              {resolutions.length} file{resolutions.length !== 1 ? 's' : ''}{' '}
              resolved
            </span>
            {acceptedCount > 0 && (
              <span className="status-accepted">{acceptedCount} accepted</span>
            )}
            {rejectedCount > 0 && (
              <span className="status-rejected">{rejectedCount} rejected</span>
            )}
            {pendingCount > 0 && (
              <span className="status-pending">{pendingCount} pending</span>
            )}
          </div>

          {resolutions.length >= 5 && (
            <TextBox
              className="copilot-conflict-filter"
              placeholder="Filter files…"
              value={this.state.filterText}
              onValueChanged={this.onFilterTextChanged}
              displayClearButton={true}
              type="search"
            />
          )}

          <div className="copilot-conflict-file-list" role="list">
            {filteredResolutions.map(resolution =>
              this.renderFileResolution(resolution)
            )}
            {filteredResolutions.length === 0 && this.state.filterText && (
              <div className="copilot-conflict-no-results">
                No files match "{this.state.filterText}"
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={this.getApplyButtonText(acceptedCount, pendingCount)}
            okButtonDisabled={acceptedCount === 0 && pendingCount === 0}
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

  private renderFileResolution(resolution: IFileResolution): JSX.Element {
    const { path } = resolution
    const status = this.state.fileStatuses.get(path) ?? 'pending'
    const isExpanded = this.state.expandedFiles.has(path)
    const fileName = Path.basename(path)
    const dirPath = Path.dirname(path)

    return (
      <div
        key={path}
        className={`copilot-conflict-file-item file-status-${status}`}
        role="listitem"
      >
        <div className="copilot-conflict-file-header">
          <div className="copilot-conflict-file-info">
            <Button
              className="copilot-conflict-expand-toggle"
              onClick={this.onToggleExpand(path)}
              ariaExpanded={isExpanded}
              ariaLabel={isExpanded ? 'Collapse preview' : 'Expand preview'}
            >
              <Octicon
                symbol={
                  isExpanded ? octicons.chevronDown : octicons.chevronRight
                }
              />
            </Button>
            <div className="copilot-conflict-file-path">
              <span className="copilot-conflict-file-name">{fileName}</span>
              {dirPath !== '.' && (
                <span className="copilot-conflict-dir-path">{dirPath}/</span>
              )}
            </div>
            {this.renderConfidenceBadge(resolution.confidence)}
          </div>

          <div className="copilot-conflict-file-actions">
            {status !== 'accepted' && (
              <Button
                className="copilot-conflict-accept-button"
                onClick={this.onSetFileStatus(path, 'accepted')}
                tooltip="Accept this resolution"
                size="small"
              >
                <Octicon symbol={octicons.check} />
                {' Accept'}
              </Button>
            )}
            {status !== 'rejected' && (
              <Button
                className="copilot-conflict-reject-button"
                onClick={this.onSetFileStatus(path, 'rejected')}
                tooltip="Reject this resolution"
                size="small"
              >
                <Octicon symbol={octicons.x} />
                {' Reject'}
              </Button>
            )}
            {status !== 'pending' && (
              <Button
                className="copilot-conflict-undo-button"
                onClick={this.onSetFileStatus(path, 'pending')}
                tooltip="Undo decision"
                size="small"
              >
                Undo
              </Button>
            )}
          </div>
        </div>

        <div className="copilot-conflict-reasoning">{resolution.reasoning}</div>

        {isExpanded && (
          <div className="copilot-conflict-preview">
            <pre className="copilot-conflict-resolved-content">
              <code>{resolution.resolvedContent}</code>
            </pre>
          </div>
        )}
      </div>
    )
  }

  private renderConfidenceBadge(
    confidence: ConflictResolutionConfidence
  ): JSX.Element {
    return (
      <span className={`copilot-conflict-confidence confidence-${confidence}`}>
        {confidence}
      </span>
    )
  }

  private getFilteredResolutions(): ReadonlyArray<IFileResolution> {
    const { resolutions } = this.props.resolutions
    const { filterText } = this.state

    if (!filterText) {
      return resolutions
    }

    const lowerFilter = filterText.toLowerCase()
    return resolutions.filter(r => r.path.toLowerCase().includes(lowerFilter))
  }

  private getCountByStatus(status: FileResolutionStatus): number {
    let count = 0
    for (const s of this.state.fileStatuses.values()) {
      if (s === status) {
        count++
      }
    }
    return count
  }

  private getApplyButtonText(
    acceptedCount: number,
    pendingCount: number
  ): string {
    const total = acceptedCount + pendingCount
    if (total === 0) {
      return 'Apply'
    }
    return `Accept & Apply ${total} file${total !== 1 ? 's' : ''}`
  }

  private onFilterTextChanged = (value: string) => {
    this.setState({ filterText: value })
  }

  private onToggleExpand = (path: string) => () => {
    this.setState(prevState => {
      const expandedFiles = new Set(prevState.expandedFiles)
      if (expandedFiles.has(path)) {
        expandedFiles.delete(path)
      } else {
        expandedFiles.add(path)
      }
      return { expandedFiles }
    })
  }

  private onSetFileStatus =
    (path: string, status: FileResolutionStatus) => () => {
      this.setState(prevState => {
        const fileStatuses = new Map(prevState.fileStatuses)
        fileStatuses.set(path, status)
        return { fileStatuses }
      })
    }

  /**
   * Accept all pending files and apply all accepted resolutions.
   *
   * "Accept All" marks pending files as accepted, then writes every accepted
   * file's resolved content to disk.
   */
  private onAcceptAll = async () => {
    // Mark all pending as accepted
    const fileStatuses = new Map(this.state.fileStatuses)
    for (const [path, status] of fileStatuses) {
      if (status === 'pending') {
        fileStatuses.set(path, 'accepted')
      }
    }
    this.setState({ fileStatuses, isApplying: true, applyError: null })

    const acceptedResolutions = this.props.resolutions.resolutions.filter(
      r => fileStatuses.get(r.path) === 'accepted'
    )

    if (acceptedResolutions.length === 0) {
      this.props.onDismissed()
      return
    }

    try {
      await this.props.dispatcher.applyCopilotConflictResolutions(
        this.props.repository,
        acceptedResolutions
      )
      this.props.onDismissed()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.setState({ isApplying: false, applyError: message })
    }
  }
}
