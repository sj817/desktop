import * as React from 'react'
import classNames from 'classnames'
import { ResolutionTab } from './resolution-compare-tabs'

interface IResolutionCodePreviewProps {
  /** The raw code content to display. */
  readonly code: string

  /** Which tab is being shown — affects conflict marker highlighting. */
  readonly tab: ResolutionTab
}

/** Region types within a conflict block. */
type ConflictRegion = 'ours' | 'theirs' | 'marker' | 'none'

/**
 * A code preview component that renders source code with line numbers.
 *
 * When displaying the "conflict" tab, conflict markers are syntax-highlighted
 * with colored backgrounds to distinguish the ours/theirs sections. The Copilot
 * tab receives a subtle left-border accent.
 */
export class ResolutionCodePreview extends React.Component<IResolutionCodePreviewProps> {
  public render() {
    const lines = this.props.code.split('\n')
    const isConflictTab = this.props.tab === 'conflict'
    const isCopilotTab = this.props.tab === 'copilot'
    const regions = isConflictTab ? this.computeRegions(lines) : null

    const containerClass = classNames('resolution-code-preview', {
      'copilot-code': isCopilotTab,
    })

    return (
      <div className={containerClass}>
        <table className="code-table">
          <tbody>
            {lines.map((line, index) => {
              const region = regions !== null ? regions[index] : 'none'
              return this.renderLine(line, index, region)
            })}
          </tbody>
        </table>
      </div>
    )
  }

  private renderLine(line: string, index: number, region: ConflictRegion) {
    const lineClass = classNames('code-line', {
      'conflict-ours': region === 'ours',
      'conflict-theirs': region === 'theirs',
      'conflict-marker': region === 'marker',
    })

    return (
      <tr key={index} className={lineClass}>
        <td className="line-number">{index + 1}</td>
        <td className="line-content">
          <pre>{line}</pre>
        </td>
      </tr>
    )
  }

  /**
   * Pre-compute conflict regions for all lines so we can correctly
   * color the ours/theirs sections between markers.
   */
  private computeRegions(
    lines: ReadonlyArray<string>
  ): ReadonlyArray<ConflictRegion> {
    let currentRegion: ConflictRegion = 'none'
    return lines.map(line => {
      const trimmed = line.trimStart()
      if (trimmed.startsWith('<<<<<<<')) {
        currentRegion = 'ours'
        return 'marker'
      }
      if (trimmed.startsWith('=======')) {
        currentRegion = 'theirs'
        return 'marker'
      }
      if (trimmed.startsWith('>>>>>>>')) {
        currentRegion = 'none'
        return 'marker'
      }
      return currentRegion
    })
  }
}
