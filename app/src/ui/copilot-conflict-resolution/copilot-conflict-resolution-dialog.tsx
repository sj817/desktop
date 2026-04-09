import * as React from 'react'
import { join } from 'path'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import {
  WorkingDirectoryStatus,
  WorkingDirectoryFileChange,
  isConflictWithMarkers,
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

  /** Current value of the "always resolve with Copilot" preference. */
  readonly alwaysResolveCopilotConflicts: boolean

  /** Called to exit Copilot mode and return to the standard conflicts dialog. */
  readonly onExitCopilotMode: () => void
}

interface ICopilotConflictResolutionDialogState {
  readonly isCommitting: boolean
  readonly isAborting: boolean
  readonly isFileResolutionOptionsMenuOpen: boolean
}

/**
 * Copilot-enhanced conflict resolution dialog.
 *
 * Mirrors the standard ConflictsDialog structure but adds per-file Copilot
 * suggestions as an additional resolution option alongside ours/theirs.
 */
export class CopilotConflictResolutionDialog extends React.Component<
  ICopilotConflictResolutionDialogProps,
  ICopilotConflictResolutionDialogState
> {
  /** Tracks whether we've ever seen resolved files, for the "undone" banner */
  private hasSeenResolvedFiles = false

  public constructor(props: ICopilotConflictResolutionDialogProps) {
    super(props)
    this.state = {
      isCommitting: false,
      isAborting: false,
      isFileResolutionOptionsMenuOpen: false,
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

  private onSubmit = async () => {
    this.setState({ isCommitting: true })
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

  /**
   * Get the Copilot resolution for a given file path, if one exists.
   */
  private getCopilotResolution(filePath: string): IFileResolution | undefined {
    return this.props.copilotResponse.resolutions.find(r => r.path === filePath)
  }

  /**
   * Apply Copilot's suggestion for a single file by writing the resolved
   * content to disk.
   */
  private onUseCopilotSuggestion = async (filePath: string) => {
    const resolution = this.getCopilotResolution(filePath)
    if (resolution === undefined) {
      return
    }

    await this.props.dispatcher.applyCopilotConflictResolutions(
      this.props.repository,
      [resolution]
    )
  }

  private onAlwaysResolveCopilotConflictsChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.dispatcher.setAlwaysResolveCopilotConflicts(
      event.currentTarget.checked
    )
  }

  /**
   * Renders a single unmerged file row with Copilot-enhanced actions.
   */
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

    // If this file is already resolved (no conflict markers remain, or manual
    // resolution chosen), show the resolved state.
    if (!hasUnresolvedConflicts(file.status, manualResolution)) {
      return this.renderResolvedFile(file, manualResolution)
    }

    // File still has conflicts — show action buttons
    const isTextConflict = isConflictWithMarkers(file.status)
    const disabled = resolvedExternalEditor === null

    const onDropdownClick = () => {
      const absoluteFilePath = join(this.props.repository.path, file.path)
      const items: IMenuItem[] = []

      // "Use Copilot's suggestion" — only for text conflicts with a resolution
      if (copilotResolution !== undefined && isTextConflict) {
        items.push({
          label: 'Use Copilot\u2019s suggestion',
          action: () => this.onUseCopilotSuggestion(file.path),
        })
        items.push({ type: 'separator' })
      }

      // Open in editor / reveal in file manager
      items.push({
        label: OpenWithDefaultProgramLabel,
        action: () => openFile(absoluteFilePath, this.props.dispatcher),
      })
      items.push({
        label: RevealInFileManagerLabel,
        action: () => revealInFileManager(this.props.repository, file.path),
      })

      // Ours / Theirs manual resolution
      if (isConflictedFile(file.status)) {
        items.push({ type: 'separator' })
        items.push({
          label: getLabelForManualResolutionOption(
            file.status.entry.us,
            ourBranch
          ),
          action: () =>
            this.props.dispatcher.updateManualConflictResolution(
              this.props.repository,
              file.path,
              ManualConflictResolution.ours
            ),
        })
        items.push({
          label: getLabelForManualResolutionOption(
            file.status.entry.them,
            theirBranch
          ),
          action: () =>
            this.props.dispatcher.updateManualConflictResolution(
              this.props.repository,
              file.path,
              ManualConflictResolution.theirs
            ),
        })
      }

      this.setIsFileResolutionOptionsMenuOpen(true)
      showContextualMenu(items).then(() => {
        this.setIsFileResolutionOptionsMenuOpen(false)
      })
    }

    // Build the subtitle: Copilot reasoning or conflict count
    let subtitle = 'Manual conflict'
    if (copilotResolution !== undefined) {
      subtitle = copilotResolution.reasoning
    } else if (isTextConflict && isConflictWithMarkers(file.status)) {
      const markerCount = file.status.conflictMarkerCount
      const conflicts = Math.ceil(markerCount / 3)
      subtitle = conflicts === 1 ? '1 conflict' : conflicts + ' conflicts'
    }

    const openEditorButtonClassName = isFirstConflictedFile
      ? `small-button button-group-item ${DialogPreferredFocusClassName}`
      : 'small-button button-group-item'

    // Per-file action handlers need to capture file.path
    const onApplyCopilot = () => this.onUseCopilotSuggestion(file.path)
    const onOpenEditor = () =>
      this.props.openFileInExternalEditor(
        join(this.props.repository.path, file.path)
      )

    return (
      <li key={file.path} className="unmerged-file-status-conflicts">
        <Octicon symbol={octicons.fileCode} className="file-octicon" />
        <div className="column-left">
          <PathText path={file.path} />
          <div className="file-conflicts-status">{subtitle}</div>
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

  /**
   * Renders a resolved file row with undo capability.
   */
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
              )
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

  private renderContent(
    unmergedFiles: ReadonlyArray<WorkingDirectoryFileChange>,
    conflictedFilesCount: number
  ): JSX.Element {
    if (unmergedFiles.length === 0) {
      return renderAllResolved()
    }

    return (
      <>
        {renderUnmergedFilesSummary(conflictedFilesCount)}
        {this.renderCopilotBanner()}
        {this.renderUnmergedFiles(unmergedFiles)}
        {renderShellLink(this.openThisRepositoryInShell)}
      </>
    )
  }

  private renderCopilotBanner(): JSX.Element {
    const { copilotResponse } = this.props
    const count = copilotResponse.resolutions.length
    const fileWord = count === 1 ? 'file' : 'files'
    return (
      <div className="copilot-suggestion-banner">
        <Octicon symbol={octicons.copilot} />
        <span>
          Copilot has suggestions for {count} {fileWord}. Use the{' '}
          <strong>Apply</strong> button or dropdown menu to accept them.
        </span>
      </div>
    )
  }

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

  public render() {
    const {
      workingDirectory,
      manualResolutions,
      headerTitle,
      submitButton,
      abortButton,
    } = this.props

    const unmergedFiles = getUnmergedFiles(workingDirectory)
    const conflictedFiles = getConflictedFiles(
      workingDirectory,
      manualResolutions
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
        title={
          <>
            <Octicon symbol={octicons.copilot} className="copilot-icon" />{' '}
            {headerTitle}
          </>
        }
        loading={this.state.isCommitting}
        disabled={this.state.isCommitting}
      >
        {this.renderBanner(conflictedFiles.length)}
        <DialogContent>
          {this.renderContent(unmergedFiles, conflictedFiles.length)}
        </DialogContent>
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
