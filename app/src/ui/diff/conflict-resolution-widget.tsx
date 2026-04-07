import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'

/** Describes the lines extracted from one side of a conflict region. */
export interface IConflictRegion {
  /** Zero-based index of this conflict within the file */
  readonly index: number
  /** Lines from our branch (between <<<<<<< and =======) */
  readonly oursLines: ReadonlyArray<string>
  /** Lines from their branch (between ======= and >>>>>>>) */
  readonly theirsLines: ReadonlyArray<string>
  /** Our branch name (from the <<<<<<< marker) */
  readonly ourBranch: string
  /** Their branch name (from the >>>>>>> marker) */
  readonly theirBranch: string
}

/** Mock Copilot suggestion for a conflict */
interface ICopilotSuggestion {
  readonly lines: ReadonlyArray<string>
  readonly reasoning: string
}

type ResolutionTab = 'ours' | 'theirs' | 'copilot'
type ResolutionState = 'pending' | 'accepted'

interface IConflictResolutionWidgetProps {
  readonly conflict: IConflictRegion
  readonly totalConflicts: number
  readonly onAccept: (index: number, tab: ResolutionTab) => void
}

interface IConflictResolutionWidgetState {
  readonly activeTab: ResolutionTab
  readonly resolutionState: ResolutionState
}

/** Mock suggestions cycling per-conflict */
const mockSuggestions: ReadonlyArray<ICopilotSuggestion> = [
  {
    lines: ['// Combined changes from both branches'],
    reasoning:
      'Both branches modified this section. The incoming changes extend the original with additional validation while preserving the local refactor.',
  },
  {
    lines: ['// Kept incoming changes with local modifications preserved'],
    reasoning:
      'The incoming branch uses the newer API. Local variable renames have been applied on top of the incoming logic.',
  },
  {
    lines: ['// Merged import statements and updated function signatures'],
    reasoning:
      'Both branches added imports. De-duplicated and sorted them, then reconciled the function signature changes.',
  },
]

/**
 * Interactive widget for resolving a single merge conflict.
 *
 * Shows three tabs — Ours, Theirs, Copilot — each displaying the
 * proposed code for that resolution strategy. The Copilot tab
 * additionally shows a reasoning explanation.
 */
export class ConflictResolutionWidget extends React.Component<
  IConflictResolutionWidgetProps,
  IConflictResolutionWidgetState
> {
  public constructor(props: IConflictResolutionWidgetProps) {
    super(props)
    this.state = {
      activeTab: 'copilot',
      resolutionState: 'pending',
    }
  }

  private onSelectOurs = () => this.setState({ activeTab: 'ours' })
  private onSelectTheirs = () => this.setState({ activeTab: 'theirs' })
  private onSelectCopilot = () => this.setState({ activeTab: 'copilot' })

  private onAccept = () => {
    this.setState({ resolutionState: 'accepted' })
    this.props.onAccept(this.props.conflict.index, this.state.activeTab)
  }

  private getMockSuggestion(): ICopilotSuggestion {
    const base =
      mockSuggestions[this.props.conflict.index % mockSuggestions.length]
    // Use the actual conflict lines to make the suggestion more realistic
    return {
      lines: [...base.lines, ...this.props.conflict.theirsLines],
      reasoning: base.reasoning,
    }
  }

  private renderCodeBlock(lines: ReadonlyArray<string>): JSX.Element {
    return (
      <pre className="conflict-code-block">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="conflict-code-line">
              {line || '\u00A0'}
            </div>
          ))}
        </code>
      </pre>
    )
  }

  private renderTabContent(): JSX.Element {
    const { conflict } = this.props
    const { activeTab } = this.state

    if (activeTab === 'ours') {
      return (
        <div className="tab-content">
          <div className="tab-content-label">
            Changes from <strong>{conflict.ourBranch}</strong>
          </div>
          {this.renderCodeBlock(conflict.oursLines)}
        </div>
      )
    }

    if (activeTab === 'theirs') {
      return (
        <div className="tab-content">
          <div className="tab-content-label">
            Changes from <strong>{conflict.theirBranch}</strong>
          </div>
          {this.renderCodeBlock(conflict.theirsLines)}
        </div>
      )
    }

    const suggestion = this.getMockSuggestion()
    return (
      <div className="tab-content copilot-tab-content">
        <div className="tab-content-label">
          <Octicon symbol={octicons.copilot} />
          Copilot suggestion
        </div>
        {this.renderCodeBlock(suggestion.lines)}
        <div className="copilot-reasoning">
          <span className="reasoning-icon">💡</span>
          <span className="reasoning-text">{suggestion.reasoning}</span>
        </div>
      </div>
    )
  }

  private renderAccepted(): JSX.Element {
    const { activeTab } = this.state
    const label =
      activeTab === 'copilot'
        ? 'Copilot'
        : activeTab === 'ours'
        ? 'ours'
        : 'theirs'

    return (
      <div className="conflict-resolution-widget accepted">
        <div className="widget-header">
          <Octicon symbol={octicons.check} className="accepted-icon" />
          <span>
            Conflict {this.props.conflict.index + 1} — resolved with {label}
          </span>
        </div>
      </div>
    )
  }

  public render() {
    if (this.state.resolutionState === 'accepted') {
      return this.renderAccepted()
    }

    const { conflict, totalConflicts } = this.props
    const { activeTab } = this.state

    return (
      <div className="conflict-resolution-widget">
        <div className="widget-header">
          <span className="conflict-label">
            Conflict {conflict.index + 1} of {totalConflicts}
          </span>
        </div>
        <div className="widget-tabs">
          <button
            className={`widget-tab ${activeTab === 'ours' ? 'active' : ''}`}
            onClick={this.onSelectOurs}
            type="button"
          >
            Ours
          </button>
          <button
            className={`widget-tab ${activeTab === 'theirs' ? 'active' : ''}`}
            onClick={this.onSelectTheirs}
            type="button"
          >
            Theirs
          </button>
          <button
            className={`widget-tab copilot-tab ${
              activeTab === 'copilot' ? 'active' : ''
            }`}
            onClick={this.onSelectCopilot}
            type="button"
          >
            <Octicon symbol={octicons.copilot} />
            Copilot
          </button>
        </div>
        {this.renderTabContent()}
        <div className="widget-actions">
          <Button className="accept-button" onClick={this.onAccept}>
            Accept
          </Button>
        </div>
      </div>
    )
  }
}
