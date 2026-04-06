import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import {
  CopilotResolutionFileCard,
  FileResolutionStatus,
} from './copilot-resolution-file-card'
import { IMockDiffLine } from './copilot-resolution-diff-preview'

interface IMockFileResolution {
  readonly filePath: string
  readonly summary: string
  readonly reasoning: string
  readonly diffLines: ReadonlyArray<IMockDiffLine>
}

const mockResolutions: ReadonlyArray<IMockFileResolution> = [
  {
    filePath: 'src/config.json',
    summary: 'Combined security settings with redesign features',
    reasoning:
      'Kept the production database host (db.internal) and SSL from the security branch, while adding the timeout setting and new dashboard feature from the redesign branch.',
    diffLines: [
      { type: 'context', content: '{' },
      { type: 'context', content: '  "database": {' },
      { type: 'removed', content: '    "host": "localhost",' },
      { type: 'removed', content: '    "ssl": false' },
      { type: 'added', content: '    "host": "db.internal",' },
      { type: 'added', content: '    "ssl": true,' },
      { type: 'added', content: '    "timeout": 30' },
      { type: 'context', content: '  },' },
      { type: 'context', content: '  "features": {' },
      { type: 'removed', content: '    "dashboard": false' },
      { type: 'added', content: '    "dashboard": true' },
      { type: 'context', content: '  }' },
      { type: 'context', content: '}' },
    ],
  },
  {
    filePath: 'src/utils.ts',
    summary: 'Added sanitization to new title parameter',
    reasoning:
      'The security branch added XSS sanitization, and the redesign branch added a title parameter. Combined both: the new function accepts a title and sanitizes all string inputs.',
    diffLines: [
      {
        type: 'removed',
        content: 'export function renderCard(name: string) {',
      },
      {
        type: 'added',
        content: 'export function renderCard(name: string, title: string) {',
      },
      { type: 'removed', content: '  return `<div>${name}</div>`' },
      { type: 'added', content: '  const safeName = sanitize(name)' },
      { type: 'added', content: '  const safeTitle = sanitize(title)' },
      {
        type: 'added',
        content: '  return `<div title="${safeTitle}">${safeName}</div>`',
      },
      { type: 'context', content: '}' },
      { type: 'context', content: '' },
      { type: 'added', content: 'function sanitize(input: string): string {' },
      {
        type: 'added',
        content:
          '  return input.replace(/[&<>"\']/g, char => `&#${char.charCodeAt(0)};`)',
      },
      { type: 'added', content: '}' },
    ],
  },
  {
    filePath: 'README.md',
    summary: 'Merged documentation sections',
    reasoning:
      'Preserved the security section and contact info from the security branch. Updated getting started with yarn commands from the redesign branch. Added API docs link.',
    diffLines: [
      { type: 'context', content: '# My Project' },
      { type: 'context', content: '' },
      { type: 'context', content: '## Getting Started' },
      { type: 'removed', content: 'Run `npm install` to get started.' },
      { type: 'added', content: 'Run `yarn install` to get started.' },
      { type: 'context', content: '' },
      { type: 'added', content: '## Security' },
      {
        type: 'added',
        content: 'Report vulnerabilities to security@example.com.',
      },
      { type: 'added', content: '' },
      { type: 'context', content: '## API Documentation' },
      { type: 'removed', content: 'See the wiki for details.' },
      {
        type: 'added',
        content: 'See the [API docs](https://docs.example.com) for details.',
      },
    ],
  },
]

/** Simulated loading time in milliseconds */
const LOADING_DELAY_MS = 1500

interface ICopilotResolutionReviewDialogProps {
  readonly onDismissed: () => void
}

interface ICopilotResolutionReviewDialogState {
  readonly isLoading: boolean
  readonly fileStatuses: ReadonlyMap<string, FileResolutionStatus>
}

/**
 * Dialog for reviewing Copilot's proposed conflict resolutions.
 *
 * Shows a summary banner, a list of file resolution cards with
 * accept/undo controls, and collapsible diff previews.
 */
export class CopilotResolutionReviewDialog extends React.Component<
  ICopilotResolutionReviewDialogProps,
  ICopilotResolutionReviewDialogState
> {
  private loadingTimer: number | null = null

  public constructor(props: ICopilotResolutionReviewDialogProps) {
    super(props)

    const fileStatuses = new Map<string, FileResolutionStatus>()
    for (const resolution of mockResolutions) {
      fileStatuses.set(resolution.filePath, 'pending')
    }

    this.state = {
      isLoading: true,
      fileStatuses,
    }
  }

  public componentDidMount() {
    this.loadingTimer = window.setTimeout(() => {
      this.setState({ isLoading: false })
    }, LOADING_DELAY_MS)
  }

  public componentWillUnmount() {
    if (this.loadingTimer !== null) {
      window.clearTimeout(this.loadingTimer)
    }
  }

  private onAcceptFile = (filePath: string) => {
    this.setState(prevState => {
      const updated = new Map(prevState.fileStatuses)
      updated.set(filePath, 'accepted')
      return { fileStatuses: updated }
    })
  }

  private onUndoFile = (filePath: string) => {
    this.setState(prevState => {
      const updated = new Map(prevState.fileStatuses)
      updated.set(filePath, 'pending')
      return { fileStatuses: updated }
    })
  }

  private onAcceptAllRemaining = () => {
    this.setState(prevState => {
      const updated = new Map(prevState.fileStatuses)
      for (const [filePath, status] of updated) {
        if (status === 'pending') {
          updated.set(filePath, 'accepted')
        }
      }
      return { fileStatuses: updated }
    })
  }

  public render() {
    return (
      <Dialog
        id="copilot-resolution-review-dialog"
        title="Copilot Conflict Resolution"
        onDismissed={this.props.onDismissed}
        onSubmit={this.onAcceptAllRemaining}
        loading={this.state.isLoading}
      >
        {this.renderBanner()}
        <DialogContent>{this.renderContent()}</DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText="Accept All Remaining"
            okButtonDisabled={this.state.isLoading || this.allFilesAccepted()}
            cancelButtonText="Back to Manual"
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderBanner() {
    if (this.state.isLoading) {
      return null
    }

    const total = mockResolutions.length
    const accepted = this.countAccepted()

    return (
      <div className="copilot-resolution-banner">
        {accepted} of {total} conflicts resolved
      </div>
    )
  }

  private renderContent() {
    if (this.state.isLoading) {
      return (
        <div className="copilot-resolution-loading">
          <p>Copilot is analyzing conflicts…</p>
        </div>
      )
    }

    return (
      <div className="copilot-resolution-file-list">
        {mockResolutions.map(resolution => (
          <CopilotResolutionFileCard
            key={resolution.filePath}
            filePath={resolution.filePath}
            summary={resolution.summary}
            reasoning={resolution.reasoning}
            diffLines={resolution.diffLines}
            status={
              this.state.fileStatuses.get(resolution.filePath) ?? 'pending'
            }
            onAccept={this.createAcceptHandler(resolution.filePath)}
            onUndo={this.createUndoHandler(resolution.filePath)}
          />
        ))}
      </div>
    )
  }

  private createAcceptHandler = (filePath: string) => () => {
    this.onAcceptFile(filePath)
  }

  private createUndoHandler = (filePath: string) => () => {
    this.onUndoFile(filePath)
  }

  private countAccepted(): number {
    let count = 0
    for (const status of this.state.fileStatuses.values()) {
      if (status === 'accepted') {
        count++
      }
    }
    return count
  }

  private allFilesAccepted(): boolean {
    return this.countAccepted() === mockResolutions.length
  }
}
