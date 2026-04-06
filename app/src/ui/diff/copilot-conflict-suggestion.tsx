import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'

/** The visual state of a suggestion card. */
type CopilotSuggestionState = 'default' | 'accepted' | 'dismissed'

interface ICopilotConflictSuggestionProps {
  /** The zero-based index of the conflict within the file. */
  readonly conflictIndex: number

  /** The lines of the proposed resolution. */
  readonly proposedCode: ReadonlyArray<string>

  /** A short explanation of why this resolution was chosen. */
  readonly reasoning: string

  /** Called when the user accepts this suggestion. */
  readonly onAccept: () => void

  /** Called when the user dismisses this suggestion. */
  readonly onDismiss: () => void
}

interface ICopilotConflictSuggestionState {
  readonly suggestionState: CopilotSuggestionState
}

/**
 * A card component that renders a Copilot-generated resolution suggestion
 * for a single merge conflict region.
 */
export class CopilotConflictSuggestion extends React.Component<
  ICopilotConflictSuggestionProps,
  ICopilotConflictSuggestionState
> {
  public constructor(props: ICopilotConflictSuggestionProps) {
    super(props)
    this.state = { suggestionState: 'default' }
  }

  private onAccept = () => {
    this.setState({ suggestionState: 'accepted' })
    this.props.onAccept()
  }

  private onDismiss = () => {
    this.setState({ suggestionState: 'dismissed' })
    this.props.onDismiss()
  }

  private renderAccepted(): JSX.Element {
    return (
      <div className="copilot-conflict-suggestion accepted">
        <div className="suggestion-header">
          <Octicon symbol={octicons.check} className="suggestion-icon-check" />
          <span className="suggestion-title">Resolution accepted</span>
        </div>
      </div>
    )
  }

  private renderDefault(): JSX.Element {
    const { proposedCode, reasoning, conflictIndex } = this.props

    return (
      <div className="copilot-conflict-suggestion">
        <div className="suggestion-header">
          <Octicon
            symbol={octicons.copilot}
            className="suggestion-icon-copilot"
          />
          <span className="suggestion-title">
            Copilot suggestion — conflict {conflictIndex + 1}
          </span>
        </div>

        <div className="suggestion-code-block">
          <pre>
            <code>
              {proposedCode.map((line, i) => (
                <div key={i} className="suggestion-code-line">
                  {line}
                </div>
              ))}
            </code>
          </pre>
        </div>

        <div className="suggestion-reasoning">
          <span className="reasoning-icon">💡</span>
          <span className="reasoning-text">{reasoning}</span>
        </div>

        <div className="suggestion-actions">
          <Button className="suggestion-accept-button" onClick={this.onAccept}>
            Accept
          </Button>
          <Button
            className="suggestion-dismiss-button"
            onClick={this.onDismiss}
          >
            Dismiss
          </Button>
        </div>
      </div>
    )
  }

  public render() {
    const { suggestionState } = this.state

    if (suggestionState === 'dismissed') {
      return null
    }

    if (suggestionState === 'accepted') {
      return this.renderAccepted()
    }

    return this.renderDefault()
  }
}
