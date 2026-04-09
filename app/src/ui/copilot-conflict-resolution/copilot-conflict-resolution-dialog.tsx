import * as React from 'react'
import * as Path from 'path'
import { promises as fs } from 'fs'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { ITextDiff } from '../../models/diff'
import { CommittedFileChange, AppFileStatusKind } from '../../models/status'
import { SideBySideDiff } from '../diff/side-by-side-diff'
import { generateDiffFromStrings } from '../../lib/diff-from-strings'
import {
  ICopilotConflictResolutionResponse,
  IFileResolution,
  ConflictResolutionConfidence,
} from '../../lib/copilot-conflict-resolution'

/**
 * How the user wants to resolve each file.
 *
 * - copilot: use Copilot's suggested content
 * - ours:    accept the existing (current branch) version
 * - theirs:  accept the incoming (other branch) version
 * - skip:    leave unresolved for manual handling
 */
type FileResolutionChoice = 'copilot' | 'ours' | 'theirs' | 'skip'

/** Top-level dialog view. */
type DialogTab = 'summary' | 'changes'

interface ICopilotConflictResolutionDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly resolutions: ICopilotConflictResolutionResponse
  readonly onDismissed: () => void
}

interface ICopilotConflictResolutionDialogState {
  /** Resolution choice per file path. */
  readonly fileChoices: ReadonlyMap<string, FileResolutionChoice>
  /** Active top-level tab. */
  readonly activeTab: DialogTab
  /** Selected file in the Changes tab. */
  readonly selectedFilePath: string | null
  /** Cached diffs: original conflict content vs Copilot resolution. */
  readonly fileDiffs: ReadonlyMap<string, ITextDiff>
  /** Files currently generating diffs. */
  readonly loadingDiffs: ReadonlySet<string>
  /** Files that failed to generate diffs (fallback to plain text). */
  readonly diffErrors: ReadonlyMap<string, string>
  /** Cached original file contents for plain-text fallback. */
  readonly originalContents: ReadonlyMap<string, string>
  /** Text used to filter the file list (Summary tab). */
  readonly filterText: string
  /** Whether we are currently applying resolutions. */
  readonly isApplying: boolean
  /** Error message to display if applying fails. */
  readonly applyError: string | null
}

/**
 * Dialog for reviewing and applying Copilot's conflict resolution suggestions.
 *
 * Offers two views via top-level tabs:
 * - **Summary**: compact file list with resolution pickers for fast decisions
 * - **Changes**: file sidebar + side-by-side diff viewer for detailed inspection
 */
export class CopilotConflictResolutionDialog extends React.Component<
  ICopilotConflictResolutionDialogProps,
  ICopilotConflictResolutionDialogState
> {
  public constructor(props: ICopilotConflictResolutionDialogProps) {
    super(props)

    const fileChoices = new Map<string, FileResolutionChoice>()
    for (const resolution of props.resolutions.resolutions) {
      fileChoices.set(resolution.path, 'copilot')
    }

    const firstPath =
      props.resolutions.resolutions.length > 0
        ? props.resolutions.resolutions[0].path
        : null

    this.state = {
      fileChoices,
      activeTab: 'summary',
      selectedFilePath: firstPath,
      fileDiffs: new Map<string, ITextDiff>(),
      loadingDiffs: new Set<string>(),
      diffErrors: new Map<string, string>(),
      originalContents: new Map<string, string>(),
      filterText: '',
      isApplying: false,
      applyError: null,
    }
  }

  public render() {
    const resolvedCount = this.getResolvedCount()
    const skippedCount = this.getCountByChoice('skip')

    return (
      <Dialog
        id="copilot-conflict-resolution-dialog"
        title={this.renderTitle()}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onApply}
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

          {this.renderDialogTabs()}

          {this.state.activeTab === 'summary'
            ? this.renderSummaryTab()
            : this.renderChangesTab()}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={this.getApplyButtonText()}
            okButtonDisabled={resolvedCount === 0}
            cancelButtonText={
              resolvedCount === 0 && skippedCount > 0 ? 'Close' : 'Cancel'
            }
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

  // -- Top-level tabs -------------------------------------------------

  private renderDialogTabs(): JSX.Element {
    const { activeTab } = this.state
    const resolvedCount = this.getResolvedCount()
    const total = this.props.resolutions.resolutions.length

    return (
      <div className="copilot-dialog-tabs">
        <button
          className={
            'copilot-dialog-tab' + (activeTab === 'summary' ? ' active' : '')
          }
          onClick={this.onSwitchTab('summary')}
          type="button"
        >
          <Octicon symbol={octicons.listUnordered} />
          {' Summary'}
          <span className="tab-badge">
            {resolvedCount}/{total}
          </span>
        </button>
        <button
          className={
            'copilot-dialog-tab' + (activeTab === 'changes' ? ' active' : '')
          }
          onClick={this.onSwitchTab('changes')}
          type="button"
        >
          <Octicon symbol={octicons.diff} />
          {' Changes'}
        </button>
      </div>
    )
  }

  // -- Summary tab ----------------------------------------------------

  private renderSummaryTab(): JSX.Element {
    const { resolutions } = this.props.resolutions
    const filteredResolutions = this.getFilteredResolutions()

    return (
      <div className="copilot-summary-tab">
        {resolutions.length >= 5 && (
          <TextBox
            className="copilot-conflict-filter"
            placeholder="Filter files\u2026"
            value={this.state.filterText}
            onValueChanged={this.onFilterTextChanged}
            displayClearButton={true}
            type="search"
          />
        )}

        <div className="copilot-conflict-file-list" role="list">
          {filteredResolutions.map(r => this.renderSummaryRow(r))}
          {filteredResolutions.length === 0 && this.state.filterText && (
            <div className="copilot-conflict-no-results">
              No files match &quot;{this.state.filterText}&quot;
            </div>
          )}
        </div>
      </div>
    )
  }

  private renderSummaryRow(resolution: IFileResolution): JSX.Element {
    const { path } = resolution
    const choice = this.state.fileChoices.get(path) ?? 'copilot'
    const fileName = Path.basename(path)
    const dirPath = Path.dirname(path)

    return (
      <div
        key={path}
        className={'copilot-conflict-file-item file-choice-' + choice}
        role="listitem"
      >
        <div className="copilot-conflict-file-header">
          <div className="copilot-conflict-file-info">
            <div className="copilot-conflict-file-path">
              <span className="copilot-conflict-file-name">{fileName}</span>
              {dirPath !== '.' && (
                <span className="copilot-conflict-dir-path">{dirPath}/</span>
              )}
            </div>
            {this.renderConfidenceBadge(resolution.confidence)}
          </div>
        </div>

        <div className="copilot-conflict-reasoning">{resolution.reasoning}</div>

        {this.renderResolutionPicker(path, choice)}
      </div>
    )
  }

  // -- Changes tab ----------------------------------------------------

  private renderChangesTab(): JSX.Element {
    const { resolutions } = this.props.resolutions
    const { selectedFilePath } = this.state
    const selectedResolution = resolutions.find(
      r => r.path === selectedFilePath
    )

    return (
      <div className="copilot-changes-tab">
        <div className="copilot-changes-sidebar">
          {resolutions.map(r => this.renderChangesFileItem(r))}
        </div>
        <div className="copilot-changes-content">
          {selectedResolution !== undefined
            ? this.renderChangesViewer(selectedResolution)
            : this.renderNoFileSelected()}
        </div>
      </div>
    )
  }

  private renderChangesFileItem(resolution: IFileResolution): JSX.Element {
    const { path } = resolution
    const choice = this.state.fileChoices.get(path) ?? 'copilot'
    const isSelected = this.state.selectedFilePath === path
    const fileName = Path.basename(path)

    return (
      <button
        key={path}
        className={
          'copilot-changes-file-entry' +
          (isSelected ? ' selected' : '') +
          ' file-choice-' +
          choice
        }
        onClick={this.onSelectFile(path)}
        type="button"
        aria-label={path}
      >
        {this.renderChoiceIcon(choice)}
        <span className="changes-file-name">{fileName}</span>
        {this.renderConfidenceBadge(resolution.confidence)}
      </button>
    )
  }

  private renderChoiceIcon(choice: FileResolutionChoice): JSX.Element {
    switch (choice) {
      case 'copilot':
        return (
          <Octicon
            symbol={octicons.copilot}
            className="choice-icon choice-copilot"
          />
        )
      case 'ours':
        return (
          <Octicon
            symbol={octicons.gitBranch}
            className="choice-icon choice-ours"
          />
        )
      case 'theirs':
        return (
          <Octicon
            symbol={octicons.gitMerge}
            className="choice-icon choice-theirs"
          />
        )
      case 'skip':
        return (
          <Octicon symbol={octicons.skip} className="choice-icon choice-skip" />
        )
    }
  }

  private renderChangesViewer(resolution: IFileResolution): JSX.Element {
    const { path } = resolution
    const choice = this.state.fileChoices.get(path) ?? 'copilot'
    const diff = this.state.fileDiffs.get(path)
    const isLoading = this.state.loadingDiffs.has(path)
    const diffError = this.state.diffErrors.get(path)

    return (
      <div className="copilot-changes-viewer">
        <div className="copilot-changes-viewer-header">
          <span className="copilot-changes-viewer-path">{path}</span>
          {this.renderResolutionPicker(path, choice)}
        </div>

        <div className="copilot-changes-diff-container">
          {isLoading && (
            <div className="copilot-changes-loading">
              <Octicon symbol={octicons.sync} className="spin" />
              <span>Generating diff...</span>
            </div>
          )}
          {diffError !== undefined &&
            this.renderDiffFallback(resolution, diffError)}
          {diff !== undefined &&
            !isLoading &&
            this.renderSideBySideDiff(path, diff)}
        </div>
      </div>
    )
  }

  private renderSideBySideDiff(filePath: string, diff: ITextDiff): JSX.Element {
    if (diff.hunks.length === 0) {
      return (
        <div className="copilot-changes-no-diff">
          <p>No changes detected between the original and resolved content.</p>
        </div>
      )
    }

    const file = new CommittedFileChange(
      filePath,
      { kind: AppFileStatusKind.Modified },
      'HEAD',
      'HEAD'
    )

    return (
      <SideBySideDiff
        file={file}
        diff={diff}
        fileContents={null}
        showSideBySideDiff={true}
        hideWhitespaceInDiff={false}
        showDiffCheckMarks={false}
        onHideWhitespaceInDiffChanged={this.onNoOp}
      />
    )
  }

  /** Plain-text fallback when diff generation fails. */
  private renderDiffFallback(
    resolution: IFileResolution,
    error: string
  ): JSX.Element {
    const originalContent = this.state.originalContents.get(resolution.path)

    return (
      <div className="copilot-changes-fallback">
        <div className="copilot-changes-fallback-warning">
          <Octicon symbol={octicons.alert} />
          <span>Could not generate diff: {error}</span>
        </div>
        <div className="copilot-changes-fallback-panels">
          <div className="copilot-changes-fallback-panel">
            <div className="fallback-panel-header">
              Original (with conflicts)
            </div>
            <pre className="copilot-changes-code">
              <code>{originalContent ?? 'Loading...'}</code>
            </pre>
          </div>
          <div className="copilot-changes-fallback-panel">
            <div className="fallback-panel-header">
              {"Copilot's Resolution"}
            </div>
            <pre className="copilot-changes-code">
              <code>{resolution.resolvedContent}</code>
            </pre>
          </div>
        </div>
      </div>
    )
  }

  private renderNoFileSelected(): JSX.Element {
    return (
      <div className="copilot-changes-no-selection">
        <p>Select a file to view its changes</p>
      </div>
    )
  }

  // -- Shared rendering -----------------------------------------------

  private renderResolutionPicker(
    path: string,
    choice: FileResolutionChoice
  ): JSX.Element {
    return (
      <div className="copilot-conflict-resolution-picker" role="radiogroup">
        <Button
          className={
            'picker-option' + (choice === 'copilot' ? ' selected' : '')
          }
          onClick={this.onSetChoice(path, 'copilot')}
          ariaPressed={choice === 'copilot'}
          size="small"
          tooltip="Use Copilot's suggested resolution"
        >
          <Octicon symbol={octicons.copilot} />
          {' Copilot'}
        </Button>
        <Button
          className={'picker-option' + (choice === 'ours' ? ' selected' : '')}
          onClick={this.onSetChoice(path, 'ours')}
          ariaPressed={choice === 'ours'}
          size="small"
          tooltip="Keep the existing version from your branch"
        >
          <Octicon symbol={octicons.gitBranch} />
          {' Ours'}
        </Button>
        <Button
          className={'picker-option' + (choice === 'theirs' ? ' selected' : '')}
          onClick={this.onSetChoice(path, 'theirs')}
          ariaPressed={choice === 'theirs'}
          size="small"
          tooltip="Accept the incoming version from the other branch"
        >
          <Octicon symbol={octicons.gitMerge} />
          {' Theirs'}
        </Button>
        <Button
          className={
            'picker-option picker-skip' + (choice === 'skip' ? ' selected' : '')
          }
          onClick={this.onSetChoice(path, 'skip')}
          ariaPressed={choice === 'skip'}
          size="small"
          tooltip="Skip - resolve this file manually later"
        >
          {' Skip'}
        </Button>
      </div>
    )
  }

  private renderConfidenceBadge(
    confidence: ConflictResolutionConfidence
  ): JSX.Element {
    return (
      <span className={'copilot-conflict-confidence confidence-' + confidence}>
        {confidence}
      </span>
    )
  }

  // -- Helpers --------------------------------------------------------

  private getFilteredResolutions(): ReadonlyArray<IFileResolution> {
    const { resolutions } = this.props.resolutions
    const { filterText } = this.state

    if (!filterText) {
      return resolutions
    }

    const lowerFilter = filterText.toLowerCase()
    return resolutions.filter(r => r.path.toLowerCase().includes(lowerFilter))
  }

  private getResolvedCount(): number {
    let count = 0
    for (const choice of this.state.fileChoices.values()) {
      if (choice !== 'skip') {
        count++
      }
    }
    return count
  }

  private getCountByChoice(target: FileResolutionChoice): number {
    let count = 0
    for (const choice of this.state.fileChoices.values()) {
      if (choice === target) {
        count++
      }
    }
    return count
  }

  private getApplyButtonText(): string {
    const resolved = this.getResolvedCount()
    if (resolved === 0) {
      return 'Apply'
    }
    return 'Apply ' + resolved + ' resolution' + (resolved !== 1 ? 's' : '')
  }

  // -- Event handlers -------------------------------------------------

  private onNoOp = () => {}

  private onSwitchTab = (tab: DialogTab) => () => {
    this.setState({ activeTab: tab })

    // Load diff for the selected file when entering the Changes tab
    if (tab === 'changes' && this.state.selectedFilePath !== null) {
      this.ensureDiffLoaded(this.state.selectedFilePath)
    }
  }

  private onFilterTextChanged = (value: string) => {
    this.setState({ filterText: value })
  }

  private onSelectFile = (path: string) => () => {
    this.setState({ selectedFilePath: path })
    this.ensureDiffLoaded(path)
  }

  private onSetChoice = (path: string, choice: FileResolutionChoice) => () => {
    this.setState(prevState => {
      const fileChoices = new Map(prevState.fileChoices)
      fileChoices.set(path, choice)
      return { fileChoices }
    })
  }

  /**
   * Generate and cache a diff for the given file path.
   *
   * Reads the original conflict file from disk, then uses
   * git diff --no-index to produce a proper ITextDiff comparing
   * the original content against Copilot's resolution.
   */
  private async ensureDiffLoaded(path: string): Promise<void> {
    if (this.state.fileDiffs.has(path) || this.state.loadingDiffs.has(path)) {
      return
    }

    this.setState(prevState => ({
      loadingDiffs: new Set(prevState.loadingDiffs).add(path),
    }))

    const resolution = this.props.resolutions.resolutions.find(
      r => r.path === path
    )
    if (resolution === undefined) {
      return
    }

    try {
      // Read the original file (with conflict markers) from disk
      const absPath = Path.join(this.props.repository.path, path)
      const originalContent = await fs.readFile(absPath, 'utf8')

      // Cache original content for fallback display
      this.setState(prevState => {
        const originalContents = new Map(prevState.originalContents)
        originalContents.set(path, originalContent)
        return { originalContents }
      })

      // Generate the diff via git diff --no-index
      const diff = await generateDiffFromStrings(
        this.props.repository,
        originalContent,
        resolution.resolvedContent,
        path
      )

      this.setState(prevState => {
        const fileDiffs = new Map(prevState.fileDiffs)
        fileDiffs.set(path, diff)
        const loadingDiffs = new Set(prevState.loadingDiffs)
        loadingDiffs.delete(path)
        return { fileDiffs, loadingDiffs }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.setState(prevState => {
        const diffErrors = new Map(prevState.diffErrors)
        diffErrors.set(path, message)
        const loadingDiffs = new Set(prevState.loadingDiffs)
        loadingDiffs.delete(path)
        return { diffErrors, loadingDiffs }
      })
    }
  }

  // -- Apply ----------------------------------------------------------

  /**
   * Apply all chosen resolutions.
   *
   * - 'copilot' files: write Copilot's content to disk
   * - 'ours' / 'theirs' files: set manual conflict resolution
   * - 'skip' files: left untouched
   */
  private onApply = async () => {
    this.setState({ isApplying: true, applyError: null })

    const { dispatcher, repository } = this.props
    const { resolutions } = this.props.resolutions

    const copilotResolutions: Array<IFileResolution> = []
    const manualChoices: Array<{
      path: string
      resolution: ManualConflictResolution
    }> = []

    for (const resolution of resolutions) {
      const choice = this.state.fileChoices.get(resolution.path) ?? 'skip'

      switch (choice) {
        case 'copilot':
          copilotResolutions.push(resolution)
          break
        case 'ours':
          manualChoices.push({
            path: resolution.path,
            resolution: ManualConflictResolution.ours,
          })
          break
        case 'theirs':
          manualChoices.push({
            path: resolution.path,
            resolution: ManualConflictResolution.theirs,
          })
          break
        case 'skip':
          break
      }
    }

    if (copilotResolutions.length === 0 && manualChoices.length === 0) {
      this.props.onDismissed()
      return
    }

    try {
      // Set manual resolutions for ours/theirs choices
      for (const { path, resolution } of manualChoices) {
        dispatcher.updateManualConflictResolution(repository, path, resolution)
      }

      // Clear any stale manual resolutions for copilot-resolved files
      for (const resolution of copilotResolutions) {
        dispatcher.updateManualConflictResolution(
          repository,
          resolution.path,
          null
        )
      }

      // Write Copilot resolutions to disk
      if (copilotResolutions.length > 0) {
        await dispatcher.applyCopilotConflictResolutions(
          repository,
          copilotResolutions
        )
      } else {
        // No Copilot files to write, but we still need to close and refresh
        dispatcher.dismissCopilotConflictResolution()
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.setState({ isApplying: false, applyError: message })
    }
  }
}
