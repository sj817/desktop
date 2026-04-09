import * as React from 'react'
import * as Path from 'path'
import { promises as fs } from 'fs'
import { Dialog, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import {
  WorkingDirectoryStatus,
  WorkingDirectoryFileChange,
  isConflictWithMarkers,
  CommittedFileChange,
  AppFileStatusKind,
} from '../../models/status'
import {
  isConflictedFile,
  getResolvedFiles,
  getConflictedFiles,
  getUnmergedFiles,
  hasUnresolvedConflicts,
  getLabelForManualResolutionOption,
} from '../../lib/status'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { ITextDiff } from '../../models/diff'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { PathText } from '../lib/path-text'
import { Button } from '../lib/button'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { showContextualMenu } from '../../lib/menu-item'
import { IMenuItem } from '../../lib/menu-item'
import {
  renderUnmergedFilesSummary,
  renderShellLink,
  renderAllResolved,
} from '../lib/conflicts'
import { DialogSuccess } from '../dialog/success'
import {
  ICopilotConflictResolutionResponse,
  IFileResolution,
} from '../../lib/copilot-conflict-resolution'
import {
  OpenWithDefaultProgramLabel,
  RevealInFileManagerLabel,
} from '../lib/context-menu'
import { openFile } from '../lib/open-file'
import { revealInFileManager } from '../../lib/app-shell'
import { DialogPreferredFocusClassName } from '../dialog'
import { SideBySideDiff } from '../diff/side-by-side-diff'
import { DiffOptions } from '../diff/diff-options'
import { Resizable } from '../resizable'
import { TabBar } from '../tab-bar'
import { generateDiffFromStrings } from '../../lib/diff-from-strings'
import { getBlobContents } from '../../lib/git/show'

/** Top-level dialog view. */
type DialogTab = 'summary' | 'changes'

/** Key for caching diffs by file path and resolution variant. */
type DiffCacheKey = string

/** Which resolution variant is being viewed in the Changes tab. */
type DiffVariant = 'copilot' | 'ours' | 'theirs'

const DefaultSidebarWidth = 250
const MinSidebarWidth = 150
const MaxSidebarWidth = 500

function diffCacheKey(path: string, variant: DiffVariant): DiffCacheKey {
  return path + '::' + variant
}

interface ICopilotConflictResolutionDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly workingDirectory: WorkingDirectoryStatus
  readonly userHasResolvedConflicts?: boolean
  readonly resolvedExternalEditor: string | null
  readonly ourBranch?: string
  readonly theirBranch?: string
  readonly manualResolutions: Map<string, ManualConflictResolution>
  readonly headerTitle: string | JSX.Element
  readonly submitButton: string
  readonly abortButton: string
  readonly onSubmit: () => Promise<void>
  readonly onAbort: () => Promise<void>
  readonly onDismissed: () => void
  readonly openFileInExternalEditor: (path: string) => void
  readonly openRepositoryInShell: (repository: Repository) => void
  readonly someConflictsHaveBeenResolved?: () => void

  /** Copilot's resolved suggestions for conflicted files. */
  readonly copilotResponse: ICopilotConflictResolutionResponse

  /** Files the user has accepted Copilot's suggestion for (undoable). */
  readonly acceptedCopilotResolutions: ReadonlySet<string>

  /** Current value of the "always resolve with Copilot" preference. */
  readonly alwaysResolveCopilotConflicts: boolean

  /** Called to exit Copilot mode and return to the standard conflicts dialog. */
  readonly onExitCopilotMode: () => void
}

interface ICopilotConflictResolutionDialogState {
  readonly isCommitting: boolean
  readonly isAborting: boolean
  readonly isFileResolutionOptionsMenuOpen: boolean

  /** Active top-level tab. */
  readonly activeTab: DialogTab

  /** Selected file in the Changes tab. */
  readonly selectedFilePath: string | null
  /** Which resolution variant to show in the diff viewer. */
  readonly selectedVariant: DiffVariant

  /** Cached diffs keyed by path::variant. */
  readonly fileDiffs: ReadonlyMap<DiffCacheKey, ITextDiff>
  /** Diff cache keys currently loading. */
  readonly loadingDiffs: ReadonlySet<DiffCacheKey>
  /** Diff cache keys that failed with an error. */
  readonly diffErrors: ReadonlyMap<DiffCacheKey, string>
  /** Cached original file contents for fallback display. */
  readonly originalContents: ReadonlyMap<string, string>

  /** Whether to show side-by-side or unified diff. */
  readonly showSideBySideDiff: boolean
  /** Width of the file sidebar in the Changes tab. */
  readonly sidebarWidth: number
}

/**
 * Copilot-enhanced conflict resolution dialog.
 *
 * Mirrors the standard ConflictsDialog structure but adds per-file Copilot
 * suggestions as an additional resolution option alongside ours/theirs.
 *
 * Offers two views via top-level tabs:
 * - **Summary**: file list with per-file Apply/dropdown actions (like the
 *   standard conflicts dialog)
 * - **Changes**: resizable file sidebar + side-by-side diff viewer for
 *   previewing Copilot's suggestions before accepting
 */
export class CopilotConflictResolutionDialog extends React.Component<
  ICopilotConflictResolutionDialogProps,
  ICopilotConflictResolutionDialogState
> {
  /** Tracks whether we've ever seen resolved files, for the "undone" banner */
  private hasSeenResolvedFiles = false

  public constructor(props: ICopilotConflictResolutionDialogProps) {
    super(props)

    // Auto-select first conflicted file for the Changes tab
    const unmergedFiles = getUnmergedFiles(props.workingDirectory)
    const firstConflicted = unmergedFiles.find(
      f =>
        isConflictedFile(f.status) &&
        hasUnresolvedConflicts(f.status, props.manualResolutions.get(f.path))
    )

    this.state = {
      isCommitting: false,
      isAborting: false,
      isFileResolutionOptionsMenuOpen: false,
      activeTab: 'summary',
      selectedFilePath: firstConflicted?.path ?? null,
      selectedVariant: 'copilot',
      fileDiffs: new Map(),
      loadingDiffs: new Set(),
      diffErrors: new Map(),
      originalContents: new Map(),
      showSideBySideDiff: true,
      sidebarWidth: DefaultSidebarWidth,
    }
  }

  public componentWillUnmount() {
    const {
      workingDirectory,
      userHasResolvedConflicts,
      manualResolutions,
      someConflictsHaveBeenResolved,
    } = this.props

    if (
      userHasResolvedConflicts ||
      someConflictsHaveBeenResolved === undefined
    ) {
      return
    }

    const resolvedConflicts = getResolvedFiles(
      workingDirectory,
      manualResolutions
    )

    if (resolvedConflicts.length > 0) {
      someConflictsHaveBeenResolved()
    }
  }

  // -- Event handlers -------------------------------------------------

  private onSubmit = async () => {
    this.setState({ isCommitting: true })

    // Write accepted Copilot resolutions to disk before continuing the merge
    const acceptedResolutions = this.props.copilotResponse.resolutions.filter(
      r => this.props.acceptedCopilotResolutions.has(r.path)
    )
    if (acceptedResolutions.length > 0) {
      await this.props.dispatcher.applyCopilotConflictResolutions(
        this.props.repository,
        acceptedResolutions
      )
    }

    await this.props.onSubmit()
  }

  private onAbort = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    this.setState({ isAborting: true })
    await this.props.onAbort()
    this.setState({ isAborting: false })
  }

  private openThisRepositoryInShell = () =>
    this.props.openRepositoryInShell(this.props.repository)

  private setIsFileResolutionOptionsMenuOpen = (
    isFileResolutionOptionsMenuOpen: boolean
  ) => {
    this.setState({ isFileResolutionOptionsMenuOpen })
  }

  private onAlwaysResolveCopilotConflictsChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.dispatcher.setAlwaysResolveCopilotConflicts(
      event.currentTarget.checked
    )
  }

  private onTabClicked = (index: number) => {
    const tab: DialogTab = index === 0 ? 'summary' : 'changes'
    this.setState({ activeTab: tab })

    // Auto-load diff when switching to Changes tab
    if (tab === 'changes' && this.state.selectedFilePath !== null) {
      this.loadDiffForFile(
        this.state.selectedFilePath,
        this.state.selectedVariant
      )
    }
  }

  private onSelectChangesFile =
    (path: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      this.setState({ selectedFilePath: path })
      this.loadDiffForFile(path, this.state.selectedVariant)
    }

  private onSelectVariant =
    (variant: DiffVariant) => (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      this.setState({ selectedVariant: variant })
      if (this.state.selectedFilePath !== null) {
        this.loadDiffForFile(this.state.selectedFilePath, variant)
      }
    }

  private onShowSideBySideDiffChanged = (showSideBySideDiff: boolean) => {
    this.setState({ showSideBySideDiff })
  }

  private onSidebarResize = (width: number) => {
    this.setState({ sidebarWidth: width })
  }

  private onSidebarReset = () => {
    this.setState({ sidebarWidth: DefaultSidebarWidth })
  }

  private onNoOp = () => {
    /* no-op callback for DiffOptions props we don't use */
  }

  // -- Helpers --------------------------------------------------------

  private getCopilotResolution(filePath: string): IFileResolution | undefined {
    return this.props.copilotResponse.resolutions.find(r => r.path === filePath)
  }

  private onUseCopilotSuggestion = (filePath: string) => {
    this.props.dispatcher.updateAcceptedCopilotResolution(
      this.props.repository,
      filePath,
      true
    )
  }

  private onUndoCopilotSuggestion = (filePath: string) => {
    this.props.dispatcher.updateAcceptedCopilotResolution(
      this.props.repository,
      filePath,
      false
    )
  }

  // -- Diff loading ---------------------------------------------------

  private async loadDiffForFile(
    filePath: string,
    variant: DiffVariant
  ): Promise<void> {
    const cacheKey = diffCacheKey(filePath, variant)

    // Already cached or loading
    if (
      this.state.fileDiffs.has(cacheKey) ||
      this.state.loadingDiffs.has(cacheKey)
    ) {
      return
    }

    this.setState(prevState => ({
      loadingDiffs: new Set(prevState.loadingDiffs).add(cacheKey),
    }))

    try {
      // Read the original file (with conflict markers) from disk
      const absPath = Path.join(this.props.repository.path, filePath)
      const originalContent = await fs.readFile(absPath, 'utf8')

      // Cache original content for fallback display
      if (!this.state.originalContents.has(filePath)) {
        this.setState(prevState => {
          const originalContents = new Map(prevState.originalContents)
          originalContents.set(filePath, originalContent)
          return { originalContents }
        })
      }

      // Get the resolved content based on variant
      let resolvedContent: string
      switch (variant) {
        case 'copilot': {
          const resolution = this.getCopilotResolution(filePath)
          if (resolution === undefined) {
            throw new Error('No Copilot resolution for ' + filePath)
          }
          resolvedContent = resolution.resolvedContent
          break
        }
        case 'ours':
          resolvedContent = await this.getStageContent(filePath, ':2')
          break
        case 'theirs':
          resolvedContent = await this.getStageContent(filePath, ':3')
          break
      }

      const diff = await generateDiffFromStrings(
        this.props.repository,
        originalContent,
        resolvedContent,
        filePath
      )

      this.setState(prevState => {
        const fileDiffs = new Map(prevState.fileDiffs)
        fileDiffs.set(cacheKey, diff)
        const loadingDiffs = new Set(prevState.loadingDiffs)
        loadingDiffs.delete(cacheKey)
        return { fileDiffs, loadingDiffs }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.setState(prevState => {
        const diffErrors = new Map(prevState.diffErrors)
        diffErrors.set(cacheKey, message)
        const loadingDiffs = new Set(prevState.loadingDiffs)
        loadingDiffs.delete(cacheKey)
        return { diffErrors, loadingDiffs }
      })
    }
  }

  private async getStageContent(
    filePath: string,
    stage: ':2' | ':3'
  ): Promise<string> {
    const buffer = await getBlobContents(this.props.repository, stage, filePath)
    return buffer.toString('utf8')
  }

  // -- Summary tab (file list) ----------------------------------------

  private renderSummaryTab(
    unmergedFiles: ReadonlyArray<WorkingDirectoryFileChange>,
    conflictedFilesCount: number
  ): JSX.Element {
    if (unmergedFiles.length === 0) {
      return renderAllResolved()
    }

    return (
      <div className="copilot-summary-tab">
        {renderUnmergedFilesSummary(conflictedFilesCount)}
        {this.renderUnmergedFiles(unmergedFiles)}
        {renderShellLink(this.openThisRepositoryInShell)}
      </div>
    )
  }

  // -- File list --------------------------------------------------------

  private renderUnmergedFiles(
    files: ReadonlyArray<WorkingDirectoryFileChange>
  ) {
    let isFirstConflictedFile = true
    return (
      <ul className="unmerged-file-statuses">
        {files.map(f => {
          if (isConflictedFile(f.status)) {
            const isFirst = isFirstConflictedFile
            if (
              hasUnresolvedConflicts(
                f.status,
                this.props.manualResolutions.get(f.path)
              ) &&
              !this.props.acceptedCopilotResolutions.has(f.path)
            ) {
              isFirstConflictedFile = false
            }
            return this.renderUnmergedFile(f, isFirst)
          }
          return null
        })}
      </ul>
    )
  }

  private renderUnmergedFile(
    file: WorkingDirectoryFileChange,
    isFirstConflictedFile: boolean
  ): JSX.Element | null {
    if (!isConflictedFile(file.status)) {
      return null
    }

    const {
      manualResolutions,
      resolvedExternalEditor,
      ourBranch,
      theirBranch,
    } = this.props

    const manualResolution = manualResolutions.get(file.path)
    const copilotResolution = this.getCopilotResolution(file.path)

    if (!hasUnresolvedConflicts(file.status, manualResolution)) {
      return this.renderResolvedFile(file, manualResolution)
    }

    // File accepted by Copilot (not yet written to disk) — show as resolved
    if (this.props.acceptedCopilotResolutions.has(file.path)) {
      return this.renderCopilotAcceptedFile(file)
    }

    const isTextConflict = isConflictWithMarkers(file.status)
    const disabled = resolvedExternalEditor === null

    const onDropdownClick = () => {
      const absoluteFilePath = Path.join(this.props.repository.path, file.path)
      const items: IMenuItem[] = []

      if (copilotResolution !== undefined && isTextConflict) {
        items.push({
          label: 'Use Copilot\u2019s suggestion',
          action: () => this.onUseCopilotSuggestion(file.path),
        })
        items.push({ type: 'separator' })
      }

      items.push({
        label: OpenWithDefaultProgramLabel,
        action: () => openFile(absoluteFilePath, this.props.dispatcher),
      })
      items.push({
        label: RevealInFileManagerLabel,
        action: () => revealInFileManager(this.props.repository, file.path),
      })

      if (isConflictedFile(file.status)) {
        items.push({ type: 'separator' })
        items.push({
          label: getLabelForManualResolutionOption(
            file.status.entry.us,
            ourBranch
          ),
          action: () => {
            this.onUndoCopilotSuggestion(file.path)
            this.props.dispatcher.updateManualConflictResolution(
              this.props.repository,
              file.path,
              ManualConflictResolution.ours
            )
          },
        })
        items.push({
          label: getLabelForManualResolutionOption(
            file.status.entry.them,
            theirBranch
          ),
          action: () => {
            this.onUndoCopilotSuggestion(file.path)
            this.props.dispatcher.updateManualConflictResolution(
              this.props.repository,
              file.path,
              ManualConflictResolution.theirs
            )
          },
        })
      }

      this.setIsFileResolutionOptionsMenuOpen(true)
      showContextualMenu(items).then(() => {
        this.setIsFileResolutionOptionsMenuOpen(false)
      })
    }

    let subtitle = 'Manual conflict'
    let subtitleClassName = 'file-conflicts-status'
    if (copilotResolution !== undefined) {
      subtitle = copilotResolution.reasoning
      subtitleClassName = 'file-conflicts-status copilot-reasoning'
    } else if (isTextConflict && isConflictWithMarkers(file.status)) {
      const markerCount = file.status.conflictMarkerCount
      const conflicts = Math.ceil(markerCount / 3)
      subtitle = conflicts === 1 ? '1 conflict' : conflicts + ' conflicts'
    }

    const openEditorButtonClassName = isFirstConflictedFile
      ? `small-button button-group-item ${DialogPreferredFocusClassName}`
      : 'small-button button-group-item'

    const onApplyCopilot = () => this.onUseCopilotSuggestion(file.path)
    const onOpenEditor = () =>
      this.props.openFileInExternalEditor(
        Path.join(this.props.repository.path, file.path)
      )

    return (
      <li key={file.path} className="unmerged-file-status-conflicts">
        <Octicon symbol={octicons.fileCode} className="file-octicon" />
        <div className="column-left">
          <PathText path={file.path} />
          <div className={subtitleClassName}>{subtitle}</div>
        </div>
        <div className="action-buttons">
          {copilotResolution !== undefined && isTextConflict && (
            <Button
              className="small-button button-group-item copilot-apply-button"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={onApplyCopilot}
            >
              <Octicon symbol={octicons.copilot} />
              {' Apply'}
            </Button>
          )}
          {isTextConflict && (
            <Button
              // eslint-disable-next-line react/jsx-no-bind
              onClick={onOpenEditor}
              disabled={disabled}
              tooltip={
                disabled
                  ? __DARWIN__
                    ? 'No editor configured in Preferences > Advanced'
                    : 'No editor configured in Options > Advanced'
                  : undefined
              }
              className={openEditorButtonClassName}
            >
              {`Open in ${resolvedExternalEditor || 'editor'}`}
            </Button>
          )}
          <Button
            // eslint-disable-next-line react/jsx-no-bind
            onClick={onDropdownClick}
            className="small-button button-group-item arrow-menu"
            ariaLabel="File resolution options"
            ariaHaspopup="menu"
            ariaExpanded={this.state.isFileResolutionOptionsMenuOpen}
          >
            <Octicon symbol={octicons.triangleDown} />
          </Button>
        </div>
      </li>
    )
  }

  private renderResolvedFile(
    file: WorkingDirectoryFileChange,
    manualResolution?: ManualConflictResolution
  ): JSX.Element {
    let fileStatusSummary: string
    if (manualResolution === ManualConflictResolution.ours) {
      fileStatusSummary = `Using changes from ${
        this.props.ourBranch || 'our branch'
      }`
    } else if (manualResolution === ManualConflictResolution.theirs) {
      fileStatusSummary = `Using changes from ${
        this.props.theirBranch || 'their branch'
      }`
    } else {
      fileStatusSummary = 'No conflicts remaining'
    }

    const showUndo = manualResolution !== undefined
    const onUndo = () =>
      this.props.dispatcher.updateManualConflictResolution(
        this.props.repository,
        file.path,
        null
      )

    return (
      <li key={file.path} className="unmerged-file-status-resolved">
        <Octicon symbol={octicons.fileCode} className="file-octicon" />
        <div className="column-left" id={file.path}>
          <PathText path={file.path} />
          <div className="file-conflicts-status">{fileStatusSummary}</div>
        </div>
        {showUndo && (
          <Button
            className="undo-button"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={onUndo}
            ariaDescribedBy={file.path}
          >
            Undo
          </Button>
        )}
        <div className="green-circle">
          <Octicon symbol={octicons.check} />
        </div>
      </li>
    )
  }

  private renderCopilotAcceptedFile(
    file: WorkingDirectoryFileChange
  ): JSX.Element {
    const copilotResolution = this.getCopilotResolution(file.path)
    const reasoning = copilotResolution?.reasoning ?? 'Copilot suggestion'

    const onUndo = () => this.onUndoCopilotSuggestion(file.path)

    return (
      <li key={file.path} className="unmerged-file-status-resolved">
        <Octicon symbol={octicons.fileCode} className="file-octicon" />
        <div className="column-left" id={file.path}>
          <PathText path={file.path} />
          <div className="file-conflicts-status copilot-reasoning">
            {reasoning}
          </div>
        </div>
        <Button
          className="undo-button"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={onUndo}
          ariaDescribedBy={file.path}
        >
          Undo
        </Button>
        <div className="green-circle">
          <Octicon symbol={octicons.check} />
        </div>
      </li>
    )
  }

  // -- Changes tab (diff viewer) --------------------------------------

  private renderChangesTab(
    unmergedFiles: ReadonlyArray<WorkingDirectoryFileChange>
  ): JSX.Element {
    const { selectedFilePath } = this.state
    const selectedResolution = selectedFilePath
      ? this.getCopilotResolution(selectedFilePath)
      : undefined

    return (
      <div className="copilot-changes-tab">
        <Resizable
          width={this.state.sidebarWidth}
          minimumWidth={MinSidebarWidth}
          maximumWidth={MaxSidebarWidth}
          onResize={this.onSidebarResize}
          onReset={this.onSidebarReset}
          description="Conflict file list"
        >
          <div className="copilot-changes-sidebar">
            {unmergedFiles.map(f => {
              if (!isConflictedFile(f.status)) {
                return null
              }
              const manualRes = this.props.manualResolutions.get(f.path)
              const isResolved = !hasUnresolvedConflicts(f.status, manualRes)
              return this.renderChangesFileItem(f.path, isResolved)
            })}
          </div>
        </Resizable>
        <div className="copilot-changes-content">
          {selectedResolution !== undefined
            ? this.renderChangesViewer(selectedResolution)
            : this.renderNoFileSelected()}
        </div>
      </div>
    )
  }

  private renderChangesFileItem(
    filePath: string,
    isResolved: boolean
  ): JSX.Element {
    const isSelected = this.state.selectedFilePath === filePath
    const fileName = Path.basename(filePath)
    const hasCopilotSuggestion =
      this.getCopilotResolution(filePath) !== undefined

    return (
      <button
        key={filePath}
        className={
          'copilot-changes-file-entry' +
          (isSelected ? ' selected' : '') +
          (isResolved ? ' resolved' : '')
        }
        onClick={this.onSelectChangesFile(filePath)}
        type="button"
        aria-label={filePath}
      >
        {isResolved ? (
          <Octicon
            symbol={octicons.check}
            className="choice-icon choice-resolved"
          />
        ) : hasCopilotSuggestion ? (
          <Octicon
            symbol={octicons.copilot}
            className="choice-icon choice-copilot"
          />
        ) : (
          <Octicon
            symbol={octicons.fileCode}
            className="choice-icon choice-unresolved"
          />
        )}
        <span className="changes-file-name">{fileName}</span>
      </button>
    )
  }

  private renderChangesViewer(resolution: IFileResolution): JSX.Element {
    const { path } = resolution
    const variant = this.state.selectedVariant
    const cacheKey = diffCacheKey(path, variant)
    const diff = this.state.fileDiffs.get(cacheKey)
    const isLoading = this.state.loadingDiffs.has(cacheKey)
    const diffError = this.state.diffErrors.get(cacheKey)

    return (
      <div className="copilot-changes-viewer">
        <div className="copilot-changes-viewer-header">
          <div className="copilot-changes-viewer-info">
            <div className="copilot-changes-viewer-title-row">
              <span className="copilot-changes-viewer-path">{path}</span>
              <DiffOptions
                isInteractiveDiff={false}
                hideWhitespaceChanges={false}
                onHideWhitespaceChangesChanged={this.onNoOp}
                showSideBySideDiff={this.state.showSideBySideDiff}
                onShowSideBySideDiffChanged={this.onShowSideBySideDiffChanged}
                onDiffOptionsOpened={this.onNoOp}
              />
            </div>
            <div className="copilot-changes-viewer-reasoning">
              <Octicon symbol={octicons.copilot} />
              <span>{resolution.reasoning}</span>
            </div>
          </div>
          {this.renderVariantPicker(variant)}
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
            this.renderDiffContent(path, diff)}
        </div>
      </div>
    )
  }

  private renderVariantPicker(selectedVariant: DiffVariant): JSX.Element {
    return (
      <div className="copilot-variant-picker" role="radiogroup">
        <Button
          className={
            'picker-option' + (selectedVariant === 'copilot' ? ' selected' : '')
          }
          onClick={this.onSelectVariant('copilot')}
          ariaPressed={selectedVariant === 'copilot'}
          size="small"
        >
          <Octicon symbol={octicons.copilot} />
          {' Copilot'}
        </Button>
        <Button
          className={
            'picker-option' + (selectedVariant === 'ours' ? ' selected' : '')
          }
          onClick={this.onSelectVariant('ours')}
          ariaPressed={selectedVariant === 'ours'}
          size="small"
        >
          {' Ours'}
        </Button>
        <Button
          className={
            'picker-option' + (selectedVariant === 'theirs' ? ' selected' : '')
          }
          onClick={this.onSelectVariant('theirs')}
          ariaPressed={selectedVariant === 'theirs'}
          size="small"
        >
          {' Theirs'}
        </Button>
      </div>
    )
  }

  private renderDiffContent(filePath: string, diff: ITextDiff): JSX.Element {
    if (diff.hunks.length === 0) {
      return (
        <div className="copilot-changes-no-diff">
          <p>No changes between the original and the selected resolution.</p>
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
        showSideBySideDiff={this.state.showSideBySideDiff}
        hideWhitespaceInDiff={false}
        showDiffCheckMarks={false}
        onHideWhitespaceInDiffChanged={this.onNoOp}
      />
    )
  }

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

  // -- Banner ---------------------------------------------------------

  public renderBanner(conflictedFilesCount: number) {
    const { workingDirectory, manualResolutions } = this.props
    const countResolved = getResolvedFiles(
      workingDirectory,
      manualResolutions
    ).length

    if (countResolved > 0) {
      this.hasSeenResolvedFiles = true
    }

    if (countResolved === 0 && !this.hasSeenResolvedFiles) {
      return
    }

    if (countResolved === 0) {
      return <DialogSuccess>All resolutions have been undone.</DialogSuccess>
    }

    if (conflictedFilesCount === 0) {
      return (
        <DialogSuccess>All conflicted files have been resolved.</DialogSuccess>
      )
    }

    const conflictPluralized = countResolved === 1 ? 'file has' : 'files have'
    return (
      <DialogSuccess>
        {countResolved} conflicted {conflictPluralized} been resolved.
      </DialogSuccess>
    )
  }

  // -- Top-level tabs -------------------------------------------------

  private renderDialogTabs(
    conflictedFilesCount: number,
    totalFilesCount: number
  ): JSX.Element {
    const { activeTab } = this.state
    const resolvedCount = totalFilesCount - conflictedFilesCount
    const selectedIndex = activeTab === 'summary' ? 0 : 1

    return (
      <TabBar selectedIndex={selectedIndex} onTabClicked={this.onTabClicked}>
        <span>
          Summary
          <span className="counter">
            {resolvedCount}/{totalFilesCount}
          </span>
        </span>
        <span>Changes</span>
      </TabBar>
    )
  }

  // -- Main render ----------------------------------------------------

  public render() {
    const {
      workingDirectory,
      manualResolutions,
      headerTitle,
      submitButton,
      abortButton,
    } = this.props

    const unmergedFiles = getUnmergedFiles(workingDirectory)
    const gitConflictedFiles = getConflictedFiles(
      workingDirectory,
      manualResolutions
    )
    // Files accepted via Copilot are not yet written to disk so git still
    // reports them as conflicted. Exclude them so the Continue button enables.
    const conflictedFiles = gitConflictedFiles.filter(
      f => !this.props.acceptedCopilotResolutions.has(f.path)
    )

    const tooltipString =
      conflictedFiles.length > 0
        ? 'Resolve all changes before continuing'
        : undefined

    return (
      <Dialog
        id="copilot-conflicts-dialog"
        dismissDisabled={this.state.isCommitting}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
        title={headerTitle}
        loading={this.state.isCommitting}
        disabled={this.state.isCommitting}
        className="copilot-conflict-resolution"
      >
        {this.renderBanner(conflictedFiles.length)}
        <div className="copilot-conflict-resolution-content">
          {this.renderDialogTabs(conflictedFiles.length, unmergedFiles.length)}

          {this.state.activeTab === 'summary'
            ? this.renderSummaryTab(unmergedFiles, conflictedFiles.length)
            : this.renderChangesTab(unmergedFiles)}
        </div>
        <DialogFooter>
          <div className="copilot-conflicts-footer">
            <div className="copilot-conflicts-footer-left">
              <Checkbox
                label="Always resolve conflicts with Copilot"
                value={
                  this.props.alwaysResolveCopilotConflicts
                    ? CheckboxValue.On
                    : CheckboxValue.Off
                }
                onChange={this.onAlwaysResolveCopilotConflictsChanged}
              />
              <Button
                className="back-to-manual-button"
                onClick={this.props.onExitCopilotMode}
              >
                Back to manual
              </Button>
            </div>
            <OkCancelButtonGroup
              okButtonText={submitButton}
              okButtonDisabled={conflictedFiles.length > 0}
              okButtonTitle={tooltipString}
              cancelButtonText={abortButton}
              onCancelButtonClick={this.onAbort}
              cancelButtonDisabled={this.state.isAborting}
            />
          </div>
        </DialogFooter>
      </Dialog>
    )
  }
}
