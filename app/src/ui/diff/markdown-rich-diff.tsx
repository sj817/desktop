import * as React from 'react'
import { ITextDiff } from '../../models/diff'
import { parseMarkdownDiff, IMarkdownDiffLine } from './markdown-diff-parser'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { diffWords } from 'diff'
import { IFileContents } from './syntax-highlighting'

interface IMarkdownRichDiffProps {
  readonly diff: ITextDiff
  readonly fileContents: IFileContents | null
  readonly scrollToLine: number | null | undefined
  readonly onVisibleLineChanged: (lineNumber: number | null) => void
  readonly onScrollComplete: () => void
}

/**
 * Component that renders a markdown file in rich format with visual indicators
 * for additions, deletions, and modifications.
 */
export class MarkdownRichDiff extends React.Component<IMarkdownRichDiffProps> {
  private containerRef = React.createRef<HTMLDivElement>()
  private lineRefs = new Map<number, HTMLDivElement>()
  private scrollTimeout: NodeJS.Timeout | null = null
  private isScrollingProgrammatically = false

  public componentDidMount() {
    const container = this.containerRef.current
    if (container) {
      container.addEventListener('scroll', this.handleScroll)
    }

    if (this.props.scrollToLine !== null && this.props.scrollToLine !== undefined) {
      this.scrollToLine(this.props.scrollToLine)
    }
  }

  public componentWillUnmount() {
    const container = this.containerRef.current
    if (container) {
      container.removeEventListener('scroll', this.handleScroll)
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }
  }

  public componentDidUpdate(prevProps: IMarkdownRichDiffProps) {
    // Only scroll if we have a new scroll target (not null and different from previous)
    if (
      this.props.scrollToLine !== null &&
      this.props.scrollToLine !== undefined &&
      this.props.scrollToLine !== prevProps.scrollToLine &&
      prevProps.scrollToLine !== undefined
    ) {
      this.scrollToLine(this.props.scrollToLine)
    }
  }

  private handleScroll = () => {
    // Don't report scroll position changes during programmatic scrolling
    if (this.isScrollingProgrammatically) {
      return
    }

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }

    this.scrollTimeout = setTimeout(() => {
      const visibleLine = this.getTopVisibleLine()
      if (visibleLine !== null) {
        this.props.onVisibleLineChanged(visibleLine)
      }
    }, 150)
  }

  private getTopVisibleLine(): number | null {
    const container = this.containerRef.current
    if (!container) {
      return null
    }

    const containerTop = container.getBoundingClientRect().top
    const containerHeight = container.clientHeight
    const midpoint = containerTop + containerHeight / 3 // Use top third of viewport

    // Find the line closest to the midpoint
    let closestLine: number | null = null
    let closestDistance = Infinity

    for (const [lineNumber, element] of this.lineRefs.entries()) {
      const rect = element.getBoundingClientRect()
      const elementMid = rect.top + rect.height / 2
      const distance = Math.abs(elementMid - midpoint)

      if (distance < closestDistance && rect.bottom > containerTop && rect.top < containerTop + containerHeight) {
        closestDistance = distance
        closestLine = lineNumber
      }
    }

    return closestLine
  }

  private scrollToLine(lineNumber: number) {
    // Use setTimeout to ensure the DOM has been updated with refs
    this.isScrollingProgrammatically = true
    
    setTimeout(() => {
      const element = this.lineRefs.get(lineNumber)
      if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'start' })
        
        // Reset the flag after scrolling completes
        setTimeout(() => {
          this.isScrollingProgrammatically = false
          this.props.onScrollComplete()
        }, 100)
      } else {
        this.isScrollingProgrammatically = false
        this.props.onScrollComplete()
      }
    }, 0)
  }

  private setLineRef = (lineNumber: number) => (ref: HTMLDivElement | null) => {
    if (ref) {
      this.lineRefs.set(lineNumber, ref)
    } else {
      this.lineRefs.delete(lineNumber)
    }
  }

  private renderMarkdown(content: string): string {
    try {
      const parsed = marked(content, { breaks: true, gfm: true })
      return DOMPurify.sanitize(parsed as string)
    } catch (e) {
      return DOMPurify.sanitize(content)
    }
  }

  private renderInlineDiff(oldText: string, newText: string): string {
    const changes = diffWords(oldText, newText)
    
    let html = ''
    for (const change of changes) {
      if (change.added) {
        html += `<span class="inline-addition">${this.escapeHtml(change.value)}</span>`
      } else if (change.removed) {
        html += `<span class="inline-deletion">${this.escapeHtml(change.value)}</span>`
      } else {
        html += this.escapeHtml(change.value)
      }
    }
    
    return html
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private renderDiffLine(line: IMarkdownDiffLine, index: number, lineNumber: number): JSX.Element {
    const { type, content, deletedContent } = line

    if (type === 'context') {
      return (
        <div 
          key={index} 
          className="markdown-diff-line markdown-diff-context"
          ref={this.setLineRef(lineNumber)}
          data-line-number={lineNumber}
        >
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: this.renderMarkdown(content) }}
          />
        </div>
      )
    }

    if (type === 'added') {
      return (
        <div 
          key={index} 
          className="markdown-diff-line markdown-diff-added"
          ref={this.setLineRef(lineNumber)}
          data-line-number={lineNumber}
        >
          <div className="markdown-diff-indicator">+</div>
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: this.renderMarkdown(content) }}
          />
        </div>
      )
    }

    if (type === 'deleted') {
      return (
        <div 
          key={index} 
          className="markdown-diff-line markdown-diff-deleted"
          data-line-number="deleted"
        >
          <div className="markdown-diff-indicator">-</div>
          <div
            className="markdown-body markdown-deleted-content"
            dangerouslySetInnerHTML={{ __html: this.renderMarkdown(content) }}
          />
        </div>
      )
    }

    if (type === 'modified' && deletedContent) {
      // For modified lines, render with inline diff highlighting
      const inlineDiff = this.renderInlineDiff(deletedContent, content)
      
      return (
        <div 
          key={index} 
          className="markdown-diff-line markdown-diff-modified"
          ref={this.setLineRef(lineNumber)}
          data-line-number={lineNumber}
        >
          <div className="markdown-diff-indicator">±</div>
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: this.renderMarkdown(inlineDiff) }}
          />
        </div>
      )
    }

    return <div key={index} />
  }

  public render() {
    const lines = parseMarkdownDiff(
      this.props.diff,
      this.props.fileContents?.newContents ?? []
    )

    return (
      <div className="markdown-rich-diff" ref={this.containerRef}>
        {lines.map((line, index) => {
          // Line number is index + 1 for lines in the file content
          // Deleted lines don't have a line number in the new file
          const lineNumber = line.type === 'deleted' ? -1 : index + 1
          return this.renderDiffLine(line, index, lineNumber)
        })}
      </div>
    )
  }
}
