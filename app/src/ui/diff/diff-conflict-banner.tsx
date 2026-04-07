import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'
import {
  ConflictResolutionWidget,
  IConflictRegion,
} from './conflict-resolution-widget'
import { DiffHunk } from '../../models/diff/raw-diff'
import { DiffLineType } from '../../models/diff'

type ResolutionTab = 'ours' | 'theirs' | 'copilot'

interface IConflictBannerItemProps {
  readonly conflict: IConflictRegion
  readonly totalConflicts: number
  readonly isExpanded: boolean
  readonly isResolved: boolean
  readonly onToggle: (index: number) => void
  readonly onAccept: (index: number, tab: ResolutionTab) => void
}

/** A single conflict item row in the banner list. */
class ConflictBannerItem extends React.Component<IConflictBannerItemProps> {
  private onToggle = () => {
    this.props.onToggle(this.props.conflict.index)
  }

  public render() {
    const { conflict, totalConflicts, isExpanded, isResolved, onAccept } =
      this.props

    return (
      <div className={`conflict-banner-item ${isResolved ? 'resolved' : ''}`}>
        <button
          className="conflict-banner-item-header"
          onClick={this.onToggle}
          type="button"
        >
          <Octicon
            symbol={
              isResolved
                ? octicons.check
                : isExpanded
                ? octicons.chevronDown
                : octicons.chevronRight
            }
            className={isResolved ? 'resolved-icon' : 'chevron-icon'}
          />
          <span>Conflict {conflict.index + 1}</span>
          {!isResolved && (
            <span className="conflict-branches">
              {conflict.ourBranch} ↔ {conflict.theirBranch}
            </span>
          )}
        </button>
        {isExpanded && !isResolved && (
          <ConflictResolutionWidget
            conflict={conflict}
            totalConflicts={totalConflicts}
            onAccept={onAccept}
          />
        )}
      </div>
    )
  }
}

interface IDiffConflictBannerProps {
  readonly conflicts: ReadonlyArray<IConflictRegion>
}

interface IDiffConflictBannerState {
  /** Which conflict index is currently expanded (null = all collapsed) */
  readonly expandedConflict: number | null
  /** Set of conflict indices that have been resolved */
  readonly resolvedConflicts: ReadonlySet<number>
}

/**
 * Banner that renders above the diff viewer when a file has conflict markers.
 *
 * Lists each conflict region with an expandable interactive widget
 * offering Ours / Theirs / Copilot resolution tabs.
 */
export class DiffConflictBanner extends React.Component<
  IDiffConflictBannerProps,
  IDiffConflictBannerState
> {
  public constructor(props: IDiffConflictBannerProps) {
    super(props)
    this.state = {
      expandedConflict: props.conflicts.length > 0 ? 0 : null,
      resolvedConflicts: new Set<number>(),
    }
  }

  private onToggleConflict = (index: number) => {
    this.setState(prev => ({
      expandedConflict: prev.expandedConflict === index ? null : index,
    }))
  }

  private onAcceptConflict = (index: number, _tab: ResolutionTab) => {
    this.setState(prev => {
      const updated = new Set(prev.resolvedConflicts)
      updated.add(index)

      // Auto-expand the next unresolved conflict
      const nextUnresolved = this.props.conflicts.find(
        c => c.index > index && !updated.has(c.index)
      )

      return {
        resolvedConflicts: updated,
        expandedConflict:
          nextUnresolved !== undefined ? nextUnresolved.index : null,
      }
    })
  }

  private onResolveAllWithCopilot = () => {
    const allIndices = new Set(this.props.conflicts.map(c => c.index))
    this.setState({
      resolvedConflicts: allIndices,
      expandedConflict: null,
    })
  }

  public render() {
    const { conflicts } = this.props
    const { resolvedConflicts, expandedConflict } = this.state
    const unresolvedCount = conflicts.length - resolvedConflicts.size

    return (
      <div className="diff-conflict-banner">
        <div className="conflict-banner-header">
          <Octicon symbol={octicons.copilot} className="banner-copilot-icon" />
          <span className="banner-title">
            {unresolvedCount === 0
              ? 'All conflicts resolved'
              : `${conflicts.length} ${
                  conflicts.length === 1 ? 'conflict' : 'conflicts'
                } found`}
          </span>
          {unresolvedCount > 0 && (
            <Button
              className="resolve-all-button"
              onClick={this.onResolveAllWithCopilot}
            >
              Resolve All with Copilot
            </Button>
          )}
        </div>
        <div className="conflict-banner-list">
          {conflicts.map(conflict => (
            <ConflictBannerItem
              key={`conflict-${conflict.index}`}
              conflict={conflict}
              totalConflicts={conflicts.length}
              isExpanded={expandedConflict === conflict.index}
              isResolved={resolvedConflicts.has(conflict.index)}
              onToggle={this.onToggleConflict}
              onAccept={this.onAcceptConflict}
            />
          ))}
        </div>
      </div>
    )
  }
}

/**
 * Extracts conflict regions from diff hunks by scanning for conflict markers.
 *
 * Handles both standard and diff3/zdiff3 conflict styles (the |||||||
 * ancestor marker is detected and its lines are skipped).
 */
export function extractConflictRegions(
  hunks: ReadonlyArray<DiffHunk>
): ReadonlyArray<IConflictRegion> {
  const conflicts: IConflictRegion[] = []
  let conflictIndex = 0

  const lines: Array<{
    readonly content: string
    readonly lineNumber: number | null
  }> = []

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === DiffLineType.Hunk) {
        continue
      }
      lines.push({
        content: line.content,
        lineNumber: line.newLineNumber,
      })
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.content.startsWith('<<<<<<<')) {
      const ourBranch = line.content.replace(/^<<<<<<<\s*/, '').trim() || 'HEAD'
      const oursLines: string[] = []
      const theirsLines: string[] = []
      let theirBranch = 'incoming'
      let inOurs = true
      let inAncestor = false

      i++
      while (i < lines.length) {
        const current = lines[i]
        if (current.content.startsWith('>>>>>>>')) {
          theirBranch =
            current.content.replace(/^>>>>>>>\s*/, '').trim() || theirBranch
          break
        }
        if (current.content.startsWith('|||||||')) {
          // diff3 ancestor section — skip lines until =======
          inAncestor = true
          inOurs = false
          i++
          continue
        }
        if (current.content.startsWith('=======')) {
          inOurs = false
          inAncestor = false
          i++
          continue
        }
        if (inAncestor) {
          // Skip ancestor lines
        } else if (inOurs) {
          oursLines.push(current.content)
        } else {
          theirsLines.push(current.content)
        }
        i++
      }

      conflicts.push({
        index: conflictIndex++,
        oursLines,
        theirsLines,
        ourBranch,
        theirBranch,
      })
    }
    i++
  }

  return conflicts
}
