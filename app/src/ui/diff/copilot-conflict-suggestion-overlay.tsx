import * as React from 'react'
import { CopilotConflictSuggestion } from './copilot-conflict-suggestion'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

/** Describes a single conflict's suggestion data. */
export interface ICopilotConflictSuggestionData {
  /** The lines of the proposed resolution. */
  readonly proposedCode: ReadonlyArray<string>

  /** A short explanation of why this resolution was chosen. */
  readonly reasoning: string
}

interface ICopilotConflictSuggestionOverlayProps {
  /** The suggestion data for each conflict in the file. */
  readonly suggestions: ReadonlyArray<ICopilotConflictSuggestionData>
}

/** Tracks the resolution state of each conflict. */
type ConflictResolution = 'pending' | 'accepted' | 'dismissed'

interface ICopilotConflictSuggestionOverlayState {
  readonly resolutions: ReadonlyArray<ConflictResolution>
}

/**
 * Manages a list of Copilot suggestion cards for all conflicts in a file.
 *
 * Shows a summary header with the conflict count and a "Resolve All" link,
 * and renders one CopilotConflictSuggestion card per conflict.
 */
export class CopilotConflictSuggestionOverlay extends React.Component<
  ICopilotConflictSuggestionOverlayProps,
  ICopilotConflictSuggestionOverlayState
> {
  private onAcceptHandlers: ReadonlyArray<() => void> = []
  private onDismissHandlers: ReadonlyArray<() => void> = []

  public constructor(props: ICopilotConflictSuggestionOverlayProps) {
    super(props)
    this.state = {
      resolutions: props.suggestions.map(() => 'pending' as ConflictResolution),
    }
    this.buildHandlers()
  }

  /** Creates bound accept/dismiss handlers for each suggestion index. */
  private buildHandlers() {
    const count = this.props.suggestions.length
    this.onAcceptHandlers = Array.from(
      { length: count },
      (_, i) => () => this.updateResolution(i, 'accepted')
    )
    this.onDismissHandlers = Array.from(
      { length: count },
      (_, i) => () => this.updateResolution(i, 'dismissed')
    )
  }

  private updateResolution(index: number, resolution: ConflictResolution) {
    this.setState(prev => {
      const updated = [...prev.resolutions]
      updated[index] = resolution
      return { resolutions: updated }
    })
  }

  private onResolveAll = () => {
    this.setState({
      resolutions: this.props.suggestions.map(
        () => 'accepted' as ConflictResolution
      ),
    })
  }

  private renderAllResolved(): JSX.Element {
    return (
      <div className="copilot-overlay-all-resolved">
        <Octicon symbol={octicons.check} className="all-resolved-icon" />
        <span>All conflicts resolved by Copilot</span>
      </div>
    )
  }

  public render() {
    const { suggestions } = this.props
    const { resolutions } = this.state

    const allResolved = resolutions.every(r => r !== 'pending')
    const pendingCount = resolutions.filter(r => r === 'pending').length

    return (
      <div className="copilot-conflict-suggestion-overlay">
        <div className="overlay-header">
          <Octicon symbol={octicons.copilot} className="overlay-header-icon" />
          <span className="overlay-header-text">
            Copilot found {suggestions.length}{' '}
            {suggestions.length === 1 ? 'conflict' : 'conflicts'} in this file
          </span>
          {pendingCount > 0 && (
            <button
              className="overlay-resolve-all-link"
              onClick={this.onResolveAll}
            >
              Resolve All
            </button>
          )}
        </div>

        {allResolved ? (
          this.renderAllResolved()
        ) : (
          <div className="overlay-suggestions">
            {suggestions.map((suggestion, i) => (
              <CopilotConflictSuggestion
                key={i}
                conflictIndex={i}
                proposedCode={suggestion.proposedCode}
                reasoning={suggestion.reasoning}
                onAccept={this.onAcceptHandlers[i]}
                onDismiss={this.onDismissHandlers[i]}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
}
