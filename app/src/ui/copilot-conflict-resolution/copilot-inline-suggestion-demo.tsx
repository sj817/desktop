import * as React from 'react'
import {
  CopilotConflictSuggestionOverlay,
  ICopilotConflictSuggestionData,
} from '../diff/copilot-conflict-suggestion-overlay'

/**
 * Mock diff lines used to simulate a conflicted file view.
 *
 * Each entry is either a normal line or a conflict marker line, tagged
 * with a type so they can be styled accordingly.
 */
interface IMockDiffLine {
  readonly text: string
  readonly type: 'context' | 'ours' | 'theirs' | 'marker'
}

/** The two mock conflict regions used by this demo. */
const mockConflict1Lines: ReadonlyArray<IMockDiffLine> = [
  { text: '<<<<<<< HEAD', type: 'marker' },
  { text: "import { Button } from './button'", type: 'ours' },
  { text: '=======', type: 'marker' },
  { text: "import { Button } from '@primer/react'", type: 'theirs' },
  { text: '>>>>>>> feature-branch', type: 'marker' },
]

const mockConflict2Lines: ReadonlyArray<IMockDiffLine> = [
  { text: '<<<<<<< HEAD', type: 'marker' },
  { text: 'function validate(input: string): boolean {', type: 'ours' },
  { text: '  return input.length > 0', type: 'ours' },
  { text: '}', type: 'ours' },
  { text: '=======', type: 'marker' },
  { text: 'function validate(input: string): boolean {', type: 'theirs' },
  {
    text: '  return input.trim().length > 0 && input.length < 1000',
    type: 'theirs',
  },
  { text: '}', type: 'theirs' },
  { text: '>>>>>>> feature-branch', type: 'marker' },
]

const mockContextBefore: ReadonlyArray<IMockDiffLine> = [
  { text: "import * as React from 'react'", type: 'context' },
  { text: "import { useState } from 'react'", type: 'context' },
]

const mockContextMiddle: ReadonlyArray<IMockDiffLine> = [
  { text: '', type: 'context' },
  { text: 'interface IFormProps {', type: 'context' },
  { text: '  readonly onSubmit: () => void', type: 'context' },
  { text: '}', type: 'context' },
  { text: '', type: 'context' },
]

const mockContextAfter: ReadonlyArray<IMockDiffLine> = [
  { text: '', type: 'context' },
  { text: 'export { validate }', type: 'context' },
]

const mockSuggestions: ReadonlyArray<ICopilotConflictSuggestionData> = [
  {
    proposedCode: ["import { Button } from '@primer/react'"],
    reasoning:
      'The @primer/react import is the newer standardized library. Keeping this avoids a deprecated dependency.',
  },
  {
    proposedCode: [
      'function validate(input: string): boolean {',
      '  return input.trim().length > 0 && input.length < 1000',
      '}',
    ],
    reasoning:
      'The incoming version adds whitespace trimming and a length limit, which are both improvements. The original only checked for non-empty.',
  },
]

const mockFilePath = 'src/components/form.tsx'

/**
 * Standalone demo component that simulates the inline diff suggestion
 * experience.
 *
 * Renders mock conflict markers with colored backgrounds and
 * interleaves Copilot suggestion cards to illustrate how they would
 * appear in the real diff viewer.
 */
export class CopilotInlineSuggestionDemo extends React.Component {
  private renderDiffLines(lines: ReadonlyArray<IMockDiffLine>): JSX.Element {
    return (
      <div className="mock-diff-lines">
        {lines.map((line, i) => (
          <div key={i} className={`mock-diff-line mock-diff-line-${line.type}`}>
            <span className="mock-line-number">{'\u00A0'}</span>
            <span className="mock-line-content">{line.text || '\u00A0'}</span>
          </div>
        ))}
      </div>
    )
  }

  public render() {
    return (
      <div className="copilot-inline-suggestion-demo">
        <div className="demo-header">
          <h3>Copilot Conflict Resolution — Inline Diff Suggestions</h3>
          <p className="demo-subtitle">
            Preview of how Copilot suggestions appear alongside conflict markers
            in the diff viewer.
          </p>
        </div>

        <div className="demo-file-header">
          <span className="demo-file-path">{mockFilePath}</span>
          <span className="demo-file-badge">2 conflicts</span>
        </div>

        <div className="demo-diff-container">
          {this.renderDiffLines(mockContextBefore)}
          {this.renderDiffLines(mockConflict1Lines)}

          <div className="demo-suggestion-inline">
            <CopilotConflictSuggestionOverlay
              suggestions={[mockSuggestions[0]]}
            />
          </div>

          {this.renderDiffLines(mockContextMiddle)}
          {this.renderDiffLines(mockConflict2Lines)}

          <div className="demo-suggestion-inline">
            <CopilotConflictSuggestionOverlay
              suggestions={[mockSuggestions[1]]}
            />
          </div>

          {this.renderDiffLines(mockContextAfter)}
        </div>
      </div>
    )
  }
}
