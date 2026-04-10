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
import { renderAllResolved } from '../lib/conflicts'
import {
  ICopilotConflictResolutionResponse,
  IFileResolution,
} from '../../lib/copilot-conflict-resolution'
import {
  CopyFilePathLabel,
  CopyRelativeFilePathLabel,
  DefaultEditorLabel,
  isSafeFileExtension,
  OpenWithDefaultProgramLabel,
  RevealInFileManagerLabel,
} from '../lib/context-menu'
import { openFile } from '../lib/open-file'
import { revealInFileManager } from '../../lib/app-shell'
import { pathExists } from '../lib/path-exists'
import { SideBySideDiff } from '../diff/side-by-side-diff'
import { DiffOptions } from '../diff/diff-options'
import { Resizable } from '../resizable'
import { TabBar } from '../tab-bar'
import { FileList } from '../history/file-list'
import { ClickSource } from '../lib/list'
import { clamp } from '../../lib/clamp'
import { clipboard } from 'electron'
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

  /** Files whose per-file reasoning text is expanded (not truncated). */
  readonly expandedReasoningFiles: ReadonlySet<string>
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
      activeTab: 'summary',
      selectedFilePath: firstConflicted?.path ?? null,
      selectedVariant: 'copilot',
      fileDiffs: new Map(),
      loadingDiffs: new Set(),
      diffErrors: new Map(),
      originalContents: new Map(),
      showSideBySideDiff: true,
      sidebarWidth: DefaultSidebarWidth,
      expandedReasoningFiles: new Set(),
    }
  }

  public componentDidMount() {
    // Auto-accept all files that have Copilot suggestions. If the user wants
    // a different resolution they can change it via the dropdown.
    const { copilotResponse, acceptedCopilotResolutions, repository } =
      this.props
    const unaccepted = copilotResponse.resolutions.filter(
      r => !acceptedCopilotResolutions.has(r.path)
    )
    for (const r of unaccepted) {
      this.props.dispatcher.updateAcceptedCopilotResolution(
        repository,
        r.path,
        true
      )
    }
  }

  public componentDidUpdate(prevProps: ICopilotConflictResolutionDialogProps) {
    // When the resolution for the selected file changes, load the matching
    // diff variant so the Changes tab stays in sync with the Summary tab.
    const filePath = this.state.selectedFilePath
    if (filePath === null || this.state.activeTab !== 'changes') {
      return
    }

    const wasCopilotAccepted =
      prevProps.acceptedCopilotResolutions.has(filePath)
    const isCopilotAccepted =
      this.props.acceptedCopilotResolutions.has(filePath)
    const prevManual = prevProps.manualResolutions.get(filePath)
    const curManual = this.props.manualResolutions.get(filePath)

    if (wasCopilotAccepted !== isCopilotAccepted || prevManual !== curManual) {
      let variant: DiffVariant = 'copilot'
      if (isCopilotAccepted) {
        variant = 'copilot'
      } else if (curManual === ManualConflictResolution.ours) {
        variant = 'ours'
      } else if (curManual === ManualConflictResolution.theirs) {
        variant = 'theirs'
      }
      this.setState({ selectedVariant: variant })
      this.loadDiffForFile(filePath, variant)
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
    _conflictedFilesCount: number
  ): JSX.Element {
    if (unmergedFiles.length === 0) {
      return renderAllResolved()
    }

    const { copilotResponse } = this.props

    return (
      <div className="copilot-summary-tab">
        {copilotResponse.summary !== undefined && (
          <div className="copilot-summary-overview">
            <Octicon symbol={octicons.copilot} />
            <p>{copilotResponse.summary}</p>
          </div>
        )}
        {this.renderUnmergedFiles(unmergedFiles)}
      </div>
    )
  }

  // -- File list --------------------------------------------------------

  private renderUnmergedFiles(
    files: ReadonlyArray<WorkingDirectoryFileChange>
  ) {
    return (
      <ul className="unmerged-file-statuses">
        {files.map(f => {
          if (isConflictedFile(f.status)) {
            return this.renderUnmergedFile(f, false)
          }
          return null
        })}
      </ul>
    )
  }

  private renderUnmergedFile(
    file: WorkingDirectoryFileChange,
    _isFirstConflictedFile: boolean
  ): JSX.Element | null {
    if (!isConflictedFile(file.status)) {
      return null
    }

    const manualResolution = this.props.manualResolutions.get(file.path)
    const copilotResolution = this.getCopilotResolution(file.path)
    const isCopilotAccepted = this.props.acceptedCopilotResolutions.has(
      file.path
    )
    const isManuallyResolved = !hasUnresolvedConflicts(
      file.status,
      manualResolution
    )

    // Resolved outside of Desktop (no manual resolution, no copilot) — no dropdown
    const resolvedExternally =
      isManuallyResolved && manualResolution === undefined && !isCopilotAccepted

    const isResolved = isManuallyResolved || isCopilotAccepted

    // Determine subtitle
    let subtitle: string
    let subtitleClassName = 'file-conflicts-status'

    if (isCopilotAccepted && copilotResolution !== undefined) {
      subtitle = copilotResolution.reasoning
      subtitleClassName = 'file-conflicts-status copilot-reasoning'
    } else if (
      isManuallyResolved &&
      manualResolution === ManualConflictResolution.ours
    ) {
      subtitle = `Using changes from ${this.props.ourBranch || 'our branch'}`
    } else if (
      isManuallyResolved &&
      manualResolution === ManualConflictResolution.theirs
    ) {
      subtitle = `Using changes from ${
        this.props.theirBranch || 'their branch'
      }`
    } else if (isManuallyResolved) {
      subtitle = 'No conflicts remaining'
    } else if (copilotResolution !== undefined) {
      subtitle = copilotResolution.reasoning
      subtitleClassName = 'file-conflicts-status copilot-reasoning'
    } else if (isConflictWithMarkers(file.status)) {
      const conflicts = Math.ceil(file.status.conflictMarkerCount / 3)
      subtitle = conflicts === 1 ? '1 conflict' : `${conflicts} conflicts`
    } else {
      subtitle = 'Manual conflict'
    }

    const liClassName = isResolved
      ? 'unmerged-file-status-resolved'
      : 'unmerged-file-status-conflicts'

    return (
      <li key={file.path} className={liClassName}>
        <Octicon symbol={octicons.fileCode} className="file-octicon" />
        <div className="column-left" id={file.path}>
          <PathText path={file.path} />
          {this.renderSubtitle(file.path, subtitle, subtitleClassName)}
        </div>
        <div className="action-buttons">
          {!resolvedExternally
            ? this.renderResolutionPill(
                file,
                isCopilotAccepted,
                manualResolution
              )
            : this.renderExternallyResolvedBadge()}
          {this.renderFileActionsKebab(file)}
        </div>
      </li>
    )
  }

  private renderSubtitle(
    filePath: string,
    text: string,
    className: string
  ): JSX.Element {
    const isCopilotReasoning = className.includes('copilot-reasoning')
    const isExpanded = this.state.expandedReasoningFiles.has(filePath)

    if (!isCopilotReasoning || isExpanded) {
      return (
        <div className={className}>
          {text}
          {isCopilotReasoning && (
            <>
              {' '}
              <button
                className="show-more-toggle"
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => this.toggleReasoningExpanded(filePath)}
              >
                show less
              </button>
            </>
          )}
        </div>
      )
    }

    return (
      <div className={`${className} truncated`}>
        <span className="reasoning-text">{text}</span>
        <button
          className="show-more-toggle"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => this.toggleReasoningExpanded(filePath)}
        >
          show more
        </button>
      </div>
    )
  }

  private toggleReasoningExpanded(filePath: string) {
    this.setState(prevState => {
      const expanded = new Set(prevState.expandedReasoningFiles)
      if (expanded.has(filePath)) {
        expanded.delete(filePath)
      } else {
        expanded.add(filePath)
      }
      return { expandedReasoningFiles: expanded }
    })
  }

  /** Clickable pill showing the active resolution strategy. */
  private renderResolutionPill(
    file: WorkingDirectoryFileChange,
    isCopilotAccepted: boolean,
    manualResolution: ManualConflictResolution | undefined
  ): JSX.Element {
    let icon: React.ReactNode
    let label: string
    let pillClass: string

    if (isCopilotAccepted) {
      icon = <Octicon symbol={octicons.copilot} />
      label = 'Suggestion'
      pillClass = 'resolution-pill copilot'
    } else if (manualResolution === ManualConflictResolution.ours) {
      icon = (
        <span className="chevron-pair">
          <Octicon symbol={octicons.chevronLeft} />
          <Octicon symbol={octicons.chevronLeft} />
        </span>
      )
      label = 'Current'
      pillClass = 'resolution-pill current'
    } else if (manualResolution === ManualConflictResolution.theirs) {
      icon = (
        <span className="chevron-pair">
          <Octicon symbol={octicons.chevronRight} />
          <Octicon symbol={octicons.chevronRight} />
        </span>
      )
      label = 'Incoming'
      pillClass = 'resolution-pill incoming'
    } else {
      icon = null
      label = 'Resolve'
      pillClass = 'resolution-pill unresolved'
    }

    const onClick = () => this.showResolutionPicker(file, isCopilotAccepted)

    return (
      <Button
        // eslint-disable-next-line react/jsx-no-bind
        onClick={onClick}
        className={pillClass}
        ariaLabel={`Resolution: ${label}`}
        ariaHaspopup="menu"
      >
        {icon}
        <span className="resolution-pill-label">{label}</span>
        <Octicon symbol={octicons.triangleDown} />
      </Button>
    )
  }

  /** Badge for files resolved outside Desktop (no dropdown). */
  private renderExternallyResolvedBadge(): JSX.Element {
    return (
      <div
        className="resolution-pill resolved-externally"
        role="img"
        aria-label="Resolved externally"
      >
        <Octicon symbol={octicons.check} />
        <span className="resolution-pill-label">Resolved</span>
      </div>
    )
  }

  /** Kebab menu for file actions (open in editor, reveal, etc.). */
  private renderFileActionsKebab(
    file: WorkingDirectoryFileChange
  ): JSX.Element {
    const onClick = () => this.showFileActionsMenu(file)
    const fileName = Path.basename(file.path)

    return (
      <Button
        // eslint-disable-next-line react/jsx-no-bind
        onClick={onClick}
        className="file-actions-kebab"
        ariaLabel={`Open ${fileName} externally`}
        tooltip={`Open ${fileName} externally`}
        ariaHaspopup="menu"
      >
        <Octicon symbol={octicons.kebabHorizontal} />
      </Button>
    )
  }

  /** Resolution picker menu (Copilot / Current / Incoming). */
  private showResolutionPicker(
    file: WorkingDirectoryFileChange,
    isCopilotAccepted: boolean
  ): void {
    if (!isConflictedFile(file.status)) {
      return
    }

    const { ourBranch, theirBranch } = this.props
    const copilotResolution = this.getCopilotResolution(file.path)
    const manualResolution = this.props.manualResolutions.get(file.path)
    const isTextConflict = isConflictWithMarkers(file.status)

    const items: IMenuItem[] = []

    if (copilotResolution !== undefined && isTextConflict) {
      items.push({
        type: 'checkbox',
        label: 'Use Copilot\u2019s suggestion',
        checked: isCopilotAccepted,
        action: () => {
          if (!isCopilotAccepted) {
            this.props.dispatcher.updateManualConflictResolution(
              this.props.repository,
              file.path,
              null
            )
            this.onUseCopilotSuggestion(file.path)
          }
        },
      })
    }

    items.push({
      type: 'checkbox',
      label: getLabelForManualResolutionOption(file.status.entry.us, ourBranch),
      checked:
        !isCopilotAccepted &&
        manualResolution === ManualConflictResolution.ours,
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
      type: 'checkbox',
      label: getLabelForManualResolutionOption(
        file.status.entry.them,
        theirBranch
      ),
      checked:
        !isCopilotAccepted &&
        manualResolution === ManualConflictResolution.theirs,
      action: () => {
        this.onUndoCopilotSuggestion(file.path)
        this.props.dispatcher.updateManualConflictResolution(
          this.props.repository,
          file.path,
          ManualConflictResolution.theirs
        )
      },
    })

    showContextualMenu(items)
  }

  /** File actions menu (open in editor, reveal, copy path, etc.). */
  private showFileActionsMenu(file: WorkingDirectoryFileChange): void {
    const absoluteFilePath = Path.join(this.props.repository.path, file.path)

    const items: IMenuItem[] = [
      {
        label: `Open in ${this.props.resolvedExternalEditor || 'editor'}`,
        action: () => this.props.openFileInExternalEditor(absoluteFilePath),
        enabled: this.props.resolvedExternalEditor !== null,
      },
      {
        label: OpenWithDefaultProgramLabel,
        action: () => openFile(absoluteFilePath, this.props.dispatcher),
      },
      {
        label: RevealInFileManagerLabel,
        action: () => revealInFileManager(this.props.repository, file.path),
      },
    ]

    showContextualMenu(items)
  }

  // -- Changes tab (diff viewer) --------------------------------------

  /**
   * Convert conflicted working-directory files to CommittedFileChange instances
   * so we can reuse the standard FileList component.
   */
  private getConflictedCommittedFiles(
    unmergedFiles: ReadonlyArray<WorkingDirectoryFileChange>
  ): ReadonlyArray<CommittedFileChange> {
    return unmergedFiles
      .filter(f => isConflictedFile(f.status))
      .map(
        f =>
          new CommittedFileChange(
            f.path,
            // Use Modified status so the FileList doesn't show conflict
            // warning icons — every file in this list is conflicted by
            // definition, so the icon adds no information.
            { kind: AppFileStatusKind.Modified },
            'HEAD',
            'HEAD~1'
          )
      )
  }

  private getSelectedCommittedFile(
    files: ReadonlyArray<CommittedFileChange>
  ): CommittedFileChange | null {
    const { selectedFilePath } = this.state
    if (selectedFilePath === null) {
      return null
    }
    return files.find(f => f.path === selectedFilePath) ?? null
  }

  private onChangesFileSelected = (file: CommittedFileChange) => {
    this.setState({ selectedFilePath: file.path })
    this.loadDiffForFile(file.path, this.state.selectedVariant)
  }

  private onChangesFileDoubleClick = (row: number, _source: ClickSource) => {
    const files = this.getConflictedCommittedFiles(
      getUnmergedFiles(this.props.workingDirectory)
    )
    const file = files[row]
    if (file !== undefined) {
      const fullPath = Path.join(this.props.repository.path, file.path)
      this.props.openFileInExternalEditor(fullPath)
    }
  }

  private onChangesFileContextMenu = async (
    file: CommittedFileChange,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    const { repository } = this.props
    const fullPath = Path.join(repository.path, file.path)
    const fileExistsOnDisk = await pathExists(fullPath)
    if (!fileExistsOnDisk) {
      showContextualMenu([
        {
          label: __DARWIN__
            ? 'File Does Not Exist on Disk'
            : 'File does not exist on disk',
          enabled: false,
        },
      ])
      return
    }

    const { resolvedExternalEditor: externalEditorLabel } = this.props
    const extension = Path.extname(file.path)
    const isSafeExtension = isSafeFileExtension(extension)

    const openInExternalEditor =
      externalEditorLabel !== null
        ? `${DefaultEditorLabel} ${externalEditorLabel}`
        : DefaultEditorLabel

    const items: ReadonlyArray<IMenuItem> = [
      {
        label: CopyFilePathLabel,
        action: () => clipboard.writeText(fullPath),
      },
      {
        label: CopyRelativeFilePathLabel,
        action: () => clipboard.writeText(file.path),
      },
      { type: 'separator' },
      {
        label: RevealInFileManagerLabel,
        action: () => revealInFileManager(repository, file.path),
      },
      {
        label: openInExternalEditor,
        action: () => this.props.openFileInExternalEditor(fullPath),
        enabled: externalEditorLabel !== null,
      },
      {
        label: OpenWithDefaultProgramLabel,
        action: () => openFile(fullPath, this.props.dispatcher),
        enabled: isSafeExtension,
      },
    ]

    showContextualMenu(items)
  }

  private renderChangesTab(
    unmergedFiles: ReadonlyArray<WorkingDirectoryFileChange>
  ): JSX.Element {
    const files = this.getConflictedCommittedFiles(unmergedFiles)
    const selectedFile = this.getSelectedCommittedFile(files)
    const conflictCount = files.length

    return (
      <div className="copilot-changes-tab">
        <div className="copilot-changes-border-box">
          <div className="files-changed-header">
            <div className="commits-displayed">
              {conflictCount === 1
                ? '1 conflicted file'
                : `${conflictCount} conflicted files`}
            </div>
            <DiffOptions
              isInteractiveDiff={false}
              hideWhitespaceChanges={false}
              onHideWhitespaceChangesChanged={this.onNoOp}
              showSideBySideDiff={this.state.showSideBySideDiff}
              onShowSideBySideDiffChanged={this.onShowSideBySideDiffChanged}
              onDiffOptionsOpened={this.onNoOp}
            />
          </div>
          <div className="files-diff-viewer">
            <Resizable
              width={this.state.sidebarWidth}
              minimumWidth={MinSidebarWidth}
              maximumWidth={MaxSidebarWidth}
              onResize={this.onSidebarResize}
              onReset={this.onSidebarReset}
              description="Conflict file list"
            >
              <FileList
                files={files}
                onSelectedFileChanged={this.onChangesFileSelected}
                selectedFile={selectedFile}
                availableWidth={clamp({
                  value: this.state.sidebarWidth,
                  min: MinSidebarWidth,
                  max: MaxSidebarWidth,
                })}
                onContextMenu={this.onChangesFileContextMenu}
                onRowDoubleClick={this.onChangesFileDoubleClick}
              />
            </Resizable>
            <div className="copilot-changes-content">
              {this.state.selectedFilePath !== null
                ? this.renderChangesViewer()
                : this.renderNoFileSelected()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  private renderChangesViewer(): JSX.Element | null {
    const filePath = this.state.selectedFilePath
    if (filePath === null) {
      return this.renderNoFileSelected()
    }

    const resolution = this.getCopilotResolution(filePath)
    const unmergedFiles = getUnmergedFiles(this.props.workingDirectory)
    const file = unmergedFiles.find(f => f.path === filePath)

    // Determine which variant to show based on the actual resolution state
    const isCopilotAccepted =
      this.props.acceptedCopilotResolutions.has(filePath)
    const manualResolution = this.props.manualResolutions.get(filePath)
    let variant: DiffVariant = this.state.selectedVariant
    if (isCopilotAccepted) {
      variant = 'copilot'
    } else if (manualResolution === ManualConflictResolution.ours) {
      variant = 'ours'
    } else if (manualResolution === ManualConflictResolution.theirs) {
      variant = 'theirs'
    }

    const cacheKey = diffCacheKey(filePath, variant)
    const diff = this.state.fileDiffs.get(cacheKey)
    const isLoading = this.state.loadingDiffs.has(cacheKey)
    const diffError = this.state.diffErrors.get(cacheKey)

    // Determine subtitle
    let subtitle: string
    let subtitleClassName = 'file-conflicts-status'
    if (isCopilotAccepted && resolution !== undefined) {
      subtitle = resolution.reasoning
      subtitleClassName = 'file-conflicts-status copilot-reasoning'
    } else if (resolution !== undefined && !manualResolution) {
      subtitle = resolution.reasoning
      subtitleClassName = 'file-conflicts-status copilot-reasoning'
    } else if (manualResolution === ManualConflictResolution.ours) {
      subtitle = `Using changes from ${this.props.ourBranch || 'our branch'}`
    } else if (manualResolution === ManualConflictResolution.theirs) {
      subtitle = `Using changes from ${
        this.props.theirBranch || 'their branch'
      }`
    } else {
      subtitle = 'Unresolved'
    }

    const isManuallyResolved =
      file !== undefined &&
      isConflictedFile(file.status) &&
      !hasUnresolvedConflicts(file.status, manualResolution)
    const resolvedExternally =
      isManuallyResolved && manualResolution === undefined && !isCopilotAccepted

    return (
      <div className="copilot-changes-viewer">
        <div className="copilot-changes-viewer-header">
          <div className="column-left">
            <PathText path={filePath} />
            <div className={subtitleClassName}>{subtitle}</div>
          </div>
          <div className="action-buttons">
            {file !== undefined &&
            isConflictedFile(file.status) &&
            !resolvedExternally
              ? this.renderResolutionPill(
                  file,
                  isCopilotAccepted,
                  manualResolution
                )
              : null}
          </div>
        </div>

        <div className="copilot-changes-diff-container">
          {isLoading && (
            <div className="copilot-changes-loading">
              <Octicon symbol={octicons.sync} className="spin" />
              <span>Generating diff...</span>
            </div>
          )}
          {diffError !== undefined &&
            resolution !== undefined &&
            this.renderDiffFallback(resolution, diffError)}
          {diff !== undefined &&
            !isLoading &&
            this.renderDiffContent(filePath, diff)}
        </div>
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

    // Build the dialog title with conflict count, e.g.
    // "Resolve 3 conflicted files before Merge"
    const conflictedFileCount = unmergedFiles.filter(f =>
      isConflictedFile(f.status)
    ).length
    const fileCountLabel =
      conflictedFileCount === 1
        ? `${conflictedFileCount} conflicted file`
        : `${conflictedFileCount} conflicted files`
    const dialogTitle =
      typeof headerTitle === 'string'
        ? headerTitle.replace('conflicts', fileCountLabel)
        : headerTitle

    return (
      <Dialog
        id="copilot-conflicts-dialog"
        dismissDisabled={this.state.isCommitting}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
        title={dialogTitle}
        loading={this.state.isCommitting}
        disabled={this.state.isCommitting}
        className="copilot-conflict-resolution"
      >
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
