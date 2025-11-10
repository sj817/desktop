import * as React from 'react'
import { DiffHeader } from '../diff/diff-header'
import {
  DiffSelection,
  IDiff,
  ImageDiffType,
  ITextDiff,
} from '../../models/diff'
import { WorkingDirectoryFileChange } from '../../models/status'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { SeamlessDiffSwitcher } from '../diff/seamless-diff-switcher'
import { PopupType } from '../../models/popup'
import { MarkdownViewMode } from '../diff/markdown-view-toggle'
import { isMarkdownFile } from '../../lib/is-markdown-file'
import { getMarkdownRichDiffAsDefault, setMarkdownRichDiffAsDefault } from '../lib/markdown-rich-diff-mode'

interface IChangesProps {
  readonly repository: Repository
  readonly file: WorkingDirectoryFileChange
  readonly diff: IDiff | null
  readonly dispatcher: Dispatcher
  readonly imageDiffType: ImageDiffType

  /** Whether a commit is in progress */
  readonly isCommitting: boolean
  readonly hideWhitespaceInDiff: boolean

  /**
   * Called when the user requests to open a binary file in an the
   * system-assigned application for said file type.
   */
  readonly onOpenBinaryFile: (fullPath: string) => void

  /** Called when the user requests to open a submodule. */
  readonly onOpenSubmodule: (fullPath: string) => void

  /**
   * Called when the user is viewing an image diff and requests
   * to change the diff presentation mode.
   */
  readonly onChangeImageDiffType: (type: ImageDiffType) => void

  /**
   * Whether we should show a confirmation dialog when the user
   * discards changes
   */
  readonly askForConfirmationOnDiscardChanges: boolean

  /**
   * Whether we should display side by side diffs.
   */
  readonly showSideBySideDiff: boolean

  /** Whether or not to show the diff check marks indicating inclusion in a commit */
  readonly showDiffCheckMarks: boolean

  /** Called when the user opens the diff options popover */
  readonly onDiffOptionsOpened: () => void
}

interface IChangesState {
  readonly markdownViewMode: MarkdownViewMode
  readonly scrollToLine: number | null
}

export class Changes extends React.Component<IChangesProps, IChangesState> {
  public constructor(props: IChangesProps) {
    super(props)

    const defaultMode = getMarkdownRichDiffAsDefault()
      ? MarkdownViewMode.RichDiff
      : MarkdownViewMode.Code

    this.state = {
      markdownViewMode: defaultMode,
      scrollToLine: null,
    }
  }

  public componentDidUpdate(prevProps: IChangesProps) {
    if (prevProps.file.path !== this.props.file.path) {
      const defaultMode = getMarkdownRichDiffAsDefault()
        ? MarkdownViewMode.RichDiff
        : MarkdownViewMode.Code

      this.setState({ 
        markdownViewMode: defaultMode,
        scrollToLine: null,
      })
    }
  }
  /**
   * Whether or not it's currently possible to change the line selection
   * of a diff. Changing selection is not possible while a commit is in
   * progress or if the user has opted to hide whitespace changes.
   */
  private get lineSelectionDisabled() {
    return this.props.isCommitting || this.props.hideWhitespaceInDiff
  }

  private onDiffLineIncludeChanged = (selection: DiffSelection) => {
    if (!this.lineSelectionDisabled) {
      const { repository, file } = this.props
      this.props.dispatcher.changeFileLineSelection(repository, file, selection)
    }
  }

  private onDiscardChanges = (
    diff: ITextDiff,
    diffSelection: DiffSelection
  ) => {
    if (this.lineSelectionDisabled) {
      return
    }

    if (this.props.askForConfirmationOnDiscardChanges) {
      this.props.dispatcher.showPopup({
        type: PopupType.ConfirmDiscardSelection,
        repository: this.props.repository,
        file: this.props.file,
        diff,
        selection: diffSelection,
      })
    } else {
      this.props.dispatcher.discardChangesFromSelection(
        this.props.repository,
        this.props.file.path,
        diff,
        diffSelection
      )
    }
  }

  public render() {
    const isMarkdown = isMarkdownFile(this.props.file.path)

    return (
      <div className="diff-container">
        <DiffHeader
          path={this.props.file.path}
          status={this.props.file.status}
          diff={this.props.diff}
          showSideBySideDiff={this.props.showSideBySideDiff}
          onShowSideBySideDiffChanged={this.onShowSideBySideDiffChanged}
          hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
          onHideWhitespaceInDiffChanged={this.onHideWhitespaceInDiffChanged}
          onDiffOptionsOpened={this.props.onDiffOptionsOpened}
          markdownViewMode={isMarkdown ? this.state.markdownViewMode : undefined}
          onMarkdownViewModeChanged={isMarkdown ? this.onMarkdownViewModeChanged : undefined}
        />

        <SeamlessDiffSwitcher
          repository={this.props.repository}
          imageDiffType={this.props.imageDiffType}
          file={this.props.file}
          readOnly={false}
          onIncludeChanged={this.onDiffLineIncludeChanged}
          onDiscardChanges={this.onDiscardChanges}
          diff={this.props.diff}
          hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
          showSideBySideDiff={this.props.showSideBySideDiff}
          showDiffCheckMarks={this.props.showDiffCheckMarks}
          askForConfirmationOnDiscardChanges={
            this.props.askForConfirmationOnDiscardChanges
          }
          onOpenBinaryFile={this.props.onOpenBinaryFile}
          onOpenSubmodule={this.props.onOpenSubmodule}
          onChangeImageDiffType={this.props.onChangeImageDiffType}
          onHideWhitespaceInDiffChanged={this.onHideWhitespaceInDiffChanged}
          markdownViewMode={isMarkdown ? this.state.markdownViewMode : undefined}
          scrollToLine={this.state.scrollToLine}
          onVisibleLineChanged={this.onVisibleLineChanged}
          onScrollComplete={this.onScrollComplete}
        />
      </div>
    )
  }

  private lastVisibleLine: number | null = null

  private onMarkdownViewModeChanged = (mode: MarkdownViewMode) => {
    // Save the user's preference for next time
    const preferRichDiff = mode === MarkdownViewMode.RichDiff
    setMarkdownRichDiffAsDefault(preferRichDiff)

    // When switching views, use the last visible line as the scroll target
    this.setState({ 
      markdownViewMode: mode,
      scrollToLine: this.lastVisibleLine,
    })
  }

  private onVisibleLineChanged = (lineNumber: number | null) => {
    // Just track the visible line, don't trigger scrolling
    this.lastVisibleLine = lineNumber
  }

  private onScrollComplete = () => {
    // Clear the scroll target after scrolling is complete
    this.setState({ scrollToLine: null })
  }

  private onShowSideBySideDiffChanged = (showSideBySideDiff: boolean) => {
    this.props.dispatcher.onShowSideBySideDiffChanged(showSideBySideDiff)
  }

  private onHideWhitespaceInDiffChanged = (hideWhitespaceInDiff: boolean) => {
    return this.props.dispatcher.onHideWhitespaceInChangesDiffChanged(
      hideWhitespaceInDiff,
      this.props.repository
    )
  }
}
