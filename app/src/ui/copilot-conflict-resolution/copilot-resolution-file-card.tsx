import * as React from 'react'
import classNames from 'classnames'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { ResolutionCompareTabs, ResolutionTab } from './resolution-compare-tabs'
import { ResolutionCodePreview } from './resolution-code-preview'
import { IMockConflictFile } from './mock-conflict-data'

/** Which resolution the user picked for this file. */
export type ResolutionChoice = 'copilot' | 'ours' | 'theirs'

interface ICopilotResolutionFileCardProps {
  readonly file: IMockConflictFile
  readonly choice: ResolutionChoice | null
  readonly onAcceptCopilot: (path: string) => void
  readonly onUseOurs: (path: string) => void
  readonly onUseTheirs: (path: string) => void
  readonly onUndo: (path: string) => void
}

interface ICopilotResolutionFileCardState {
  readonly isPreviewExpanded: boolean
  readonly selectedTab: ResolutionTab
}

/**
 * A card representing a single conflicted file in the Copilot resolution
 * review dialog.
 *
 * Shows the file path, a one-line summary, per-file action buttons, and
 * a collapsible comparison preview with tabbed views of the conflict,
 * ours, theirs, and Copilot's suggestion.
 */
export class CopilotResolutionFileCard extends React.Component<
  ICopilotResolutionFileCardProps,
  ICopilotResolutionFileCardState
> {
  public constructor(props: ICopilotResolutionFileCardProps) {
    super(props)
    this.state = {
      isPreviewExpanded: false,
      selectedTab: 'copilot',
    }
  }

  public render() {
    const { file, choice } = this.props
    const isResolved = choice !== null

    const cardClass = classNames('copilot-resolution-file-card', {
      resolved: isResolved,
      'resolved-copilot': choice === 'copilot',
      'resolved-ours': choice === 'ours',
      'resolved-theirs': choice === 'theirs',
    })

    return (
      <div className={cardClass}>
        <div className="file-card-header">
          <div className="file-info">
            <Octicon symbol={octicons.fileCode} className="file-icon" />
            <div className="file-details">
              <span className="file-path">{file.path}</span>
              {isResolved ? (
                this.renderResolvedStatus()
              ) : (
                <span className="file-summary">{file.summary}</span>
              )}
            </div>
          </div>
          <div className="file-actions">{this.renderActions()}</div>
        </div>
        {this.renderPreviewToggle()}
        {this.state.isPreviewExpanded && this.renderPreview()}
      </div>
    )
  }

  private renderResolvedStatus(): JSX.Element {
    const { choice } = this.props
    const labels: Record<ResolutionChoice, string> = {
      copilot: 'Copilot suggestion accepted',
      ours: 'Using your changes',
      theirs: 'Using incoming changes',
    }
    const label = choice !== null ? labels[choice] : ''

    return (
      <span className="resolved-label">
        <Octicon symbol={octicons.check} className="resolved-check" />
        {label}
      </span>
    )
  }

  private renderActions(): JSX.Element {
    const { choice } = this.props

    if (choice !== null) {
      return (
        <Button className="undo-button" size="small" onClick={this.onUndo}>
          <Octicon symbol={octicons.history} />
          Undo
        </Button>
      )
    }

    return (
      <>
        <Button
          className="accept-copilot-button"
          size="small"
          onClick={this.onAcceptCopilot}
        >
          <Octicon symbol={octicons.copilot} />
          Accept Copilot
        </Button>
        <Button
          className="use-ours-button"
          size="small"
          onClick={this.onUseOurs}
        >
          Use Ours
        </Button>
        <Button
          className="use-theirs-button"
          size="small"
          onClick={this.onUseTheirs}
        >
          Use Theirs
        </Button>
      </>
    )
  }

  private renderPreviewToggle(): JSX.Element {
    const { isPreviewExpanded } = this.state
    const icon = isPreviewExpanded
      ? octicons.chevronDown
      : octicons.chevronRight

    return (
      <button
        className="preview-toggle"
        onClick={this.onTogglePreview}
        aria-expanded={isPreviewExpanded}
      >
        <Octicon symbol={icon} />
        <span>Preview resolution</span>
      </button>
    )
  }

  private renderPreview(): JSX.Element {
    const { file } = this.props
    const { selectedTab } = this.state
    const code = this.getCodeForTab(selectedTab)

    return (
      <div className="file-card-preview">
        <ResolutionCompareTabs
          selectedTab={selectedTab}
          onTabSelected={this.onTabSelected}
        />
        <ResolutionCodePreview code={code} tab={selectedTab} />
        {selectedTab === 'copilot' && (
          <div className="copilot-reasoning">
            <Octicon symbol={octicons.lightBulb} className="reasoning-icon" />
            <span>{file.reasoning}</span>
          </div>
        )}
      </div>
    )
  }

  private getCodeForTab(tab: ResolutionTab): string {
    const { versions } = this.props.file
    switch (tab) {
      case 'conflict':
        return versions.conflict
      case 'ours':
        return versions.ours
      case 'theirs':
        return versions.theirs
      case 'copilot':
        return versions.copilot
    }
  }

  private onTogglePreview = () => {
    this.setState(prev => ({
      isPreviewExpanded: !prev.isPreviewExpanded,
    }))
  }

  private onTabSelected = (tab: ResolutionTab) => {
    this.setState({ selectedTab: tab })
  }

  private onAcceptCopilot = () => {
    this.props.onAcceptCopilot(this.props.file.path)
  }

  private onUseOurs = () => {
    this.props.onUseOurs(this.props.file.path)
  }

  private onUseTheirs = () => {
    this.props.onUseTheirs(this.props.file.path)
  }

  private onUndo = () => {
    this.props.onUndo(this.props.file.path)
  }
}
