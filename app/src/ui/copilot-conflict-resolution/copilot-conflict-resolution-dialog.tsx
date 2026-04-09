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

/** Which preview tab is active for a given file. */
type PreviewTab = 'copilot' | 'conflict'

interface ICopilotConflictResolutionDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly resolutions: ICopilotConflictResolutionResponse
  readonly onDismissed: () => void
}

interface ICopilotConflictResolutionDialogState {
  /** Resolution choice per file path. */
  readonly fileChoices: ReadonlyMap<string, FileResolutionChoice>
  /** Which files have their preview expanded. */
  readonly expandedFiles: ReadonlySet<string>
  /** Active preview tab per file. */
  readonly activePreviewTab: ReadonlyMap<string, PreviewTab>
  /** Cached original file contents (with conflict markers). */
  readonly originalContents: ReadonlyMap<string, string>
  /** Files currently loading their original content. */
  readonly loadingOriginal: ReadonlySet<string>
  /** Files that failed to load original content. */
  readonly loadErrors: ReadonlyMap<string, string>
  /** Text used to filter the file list by path. */
  readonly filterText: string
  /** Whether we're currently applying resolutions. */
  readonly isApplying: boolean
  /** Error message to display if applying fails. */
  readonly applyError: string | null
}

/**
 * Dialog for reviewing and applying Copilot's conflict resolution suggestions.
 *
 * Each file can be resolved via Copilot's suggestion, by accepting the
 * existing (ours) or incoming (theirs) version, or skipped for manual
 * resolution later. An expandable preview lets the user compare Copilot's
 * output with the original conflict markers.
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

    this.state = {
      fileChoices,
      expandedFiles: new Set<string>(),
      activePreviewTab: new Map<string, PreviewTab>(),
      originalContents: new Map<string, string>(),
      loadingOriginal: new Set<string>(),
      loadErrors: new Map<string, string>(),
      filterText: '',
      isApplying: false,
      applyError: null,
    }
  }

  public render() {
    const { resolutions } = this.props.resolutions
    const filteredResolutions = this.getFilteredResolutions()
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

          <div className="copilot-conflict-summary">
            <span>
              {resolutions.length} conflicted file
              {resolutions.length !== 1 ? 's' : ''}
            </span>
            {resolvedCount > 0 && (
              <span className="status-accepted">
                {resolvedCount} will be resolved
              </span>
            )}
            {skippedCount > 0 && (
              <span className="status-skipped">{skippedCount} skipped</span>
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

  private renderFileResolution(resolution: IFileResolution): JSX.Element {
    const { path } = resolution
    const choice = this.state.fileChoices.get(path) ?? 'copilot'
    const isExpanded = this.state.expandedFiles.has(path)
    const fileName = Path.basename(path)
    const dirPath = Path.dirname(path)

    return (
      <div
        key={path}
        className={`copilot-conflict-file-item file-choice-${choice}`}
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
        </div>

        <div className="copilot-conflict-reasoning">{resolution.reasoning}</div>

        {this.renderResolutionPicker(path, choice)}

        {isExpanded && this.renderPreview(resolution, path)}
      </div>
    )
  }

  private renderResolutionPicker(
    path: string,
    choice: FileResolutionChoice
  ): JSX.Element {
    return (
      <div className="copilot-conflict-resolution-picker" role="radiogroup">
        <Button
          className={`picker-option ${choice === 'copilot' ? 'selected' : ''}`}
          onClick={this.onSetChoice(path, 'copilot')}
          ariaPressed={choice === 'copilot'}
          size="small"
          tooltip="Use Copilot's suggested resolution"
        >
          <Octicon symbol={octicons.copilot} />
          {' Copilot'}
        </Button>
        <Button
          className={`picker-option ${choice === 'ours' ? 'selected' : ''}`}
          onClick={this.onSetChoice(path, 'ours')}
          ariaPressed={choice === 'ours'}
          size="small"
          tooltip="Keep the existing version from your branch"
        >
          <Octicon symbol={octicons.gitBranch} />
          {' Ours'}
        </Button>
        <Button
          className={`picker-option ${choice === 'theirs' ? 'selected' : ''}`}
          onClick={this.onSetChoice(path, 'theirs')}
          ariaPressed={choice === 'theirs'}
          size="small"
          tooltip="Accept the incoming version from the other branch"
        >
          <Octicon symbol={octicons.gitMerge} />
          {' Theirs'}
        </Button>
        <Button
          className={`picker-option picker-skip ${
            choice === 'skip' ? 'selected' : ''
          }`}
          onClick={this.onSetChoice(path, 'skip')}
          ariaPressed={choice === 'skip'}
          size="small"
          tooltip="Skip — resolve this file manually later"
        >
          {' Skip'}
        </Button>
      </div>
    )
  }

  private renderPreview(
    resolution: IFileResolution,
    path: string
  ): JSX.Element {
    const activeTab = this.state.activePreviewTab.get(path) ?? 'copilot'
    const isLoadingOriginal = this.state.loadingOriginal.has(path)
    const originalContent = this.state.originalContents.get(path)
    const loadError = this.state.loadErrors.get(path)

    return (
      <div className="copilot-conflict-preview">
        <div className="copilot-conflict-preview-tabs">
          <Button
            className={`preview-tab ${activeTab === 'copilot' ? 'active' : ''}`}
            onClick={this.onSetPreviewTab(path, 'copilot')}
            size="small"
          >
            Copilot's Resolution
          </Button>
          <Button
            className={`preview-tab ${
              activeTab === 'conflict' ? 'active' : ''
            }`}
            onClick={this.onSetPreviewTab(path, 'conflict')}
            size="small"
          >
            Original Conflict
          </Button>
        </div>

        {activeTab === 'copilot' && (
          <pre className="copilot-conflict-resolved-content">
            <code>{resolution.resolvedContent}</code>
          </pre>
        )}

        {activeTab === 'conflict' && (
          <div className="copilot-conflict-original-content">
            {isLoadingOriginal && (
              <p className="loading-original">Loading original file…</p>
            )}
            {loadError !== undefined && (
              <p className="load-error">{loadError}</p>
            )}
            {originalContent !== undefined && (
              <pre className="copilot-conflict-original-code">
                <code>{originalContent}</code>
              </pre>
            )}
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

  /** Count files that will actually be resolved (not skipped). */
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
    return `Apply ${resolved} resolution${resolved !== 1 ? 's' : ''}`
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

  private onSetChoice = (path: string, choice: FileResolutionChoice) => () => {
    this.setState(prevState => {
      const fileChoices = new Map(prevState.fileChoices)
      fileChoices.set(path, choice)
      return { fileChoices }
    })
  }

  private onSetPreviewTab = (path: string, tab: PreviewTab) => () => {
    this.setState(prevState => {
      const activePreviewTab = new Map(prevState.activePreviewTab)
      activePreviewTab.set(path, tab)
      return { activePreviewTab }
    })

    // Load original content on first switch to conflict tab
    if (tab === 'conflict' && !this.state.originalContents.has(path)) {
      this.loadOriginalContent(path)
    }
  }

  private async loadOriginalContent(path: string): Promise<void> {
    if (this.state.loadingOriginal.has(path)) {
      return
    }

    this.setState(prevState => ({
      loadingOriginal: new Set(prevState.loadingOriginal).add(path),
    }))

    try {
      const absPath = Path.join(this.props.repository.path, path)
      const content = await fs.readFile(absPath, 'utf8')
      this.setState(prevState => {
        const originalContents = new Map(prevState.originalContents)
        originalContents.set(path, content)
        const loadingOriginal = new Set(prevState.loadingOriginal)
        loadingOriginal.delete(path)
        return { originalContents, loadingOriginal }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.setState(prevState => {
        const loadErrors = new Map(prevState.loadErrors)
        loadErrors.set(path, `Could not load file: ${message}`)
        const loadingOriginal = new Set(prevState.loadingOriginal)
        loadingOriginal.delete(path)
        return { loadErrors, loadingOriginal }
      })
    }
  }

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
