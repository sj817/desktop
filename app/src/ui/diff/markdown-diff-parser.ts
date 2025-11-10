import { ITextDiff } from '../../models/diff'
import { DiffLineType } from '../../models/diff/diff-line'

export type MarkdownLineType = 'added' | 'deleted' | 'modified' | 'context'

export interface IMarkdownDiffLine {
  readonly type: MarkdownLineType
  readonly content: string
  readonly deletedContent?: string
}

/**
 * Parses a text diff and extracts lines with change information for markdown rendering.
 * This merges the full file contents with diff information to show the complete file
 * with visual indicators for changes.
 */
export function parseMarkdownDiff(
  diff: ITextDiff,
  fileContents: ReadonlyArray<string>
): ReadonlyArray<IMarkdownDiffLine> {
  if (fileContents.length === 0) {
    // Fallback to diff-only rendering if file contents not available
    return parseMarkdownDiffOnly(diff)
  }

  // Create a map of line numbers to their change type
  const lineChanges = new Map<number, { type: MarkdownLineType; deletedContent?: string }>()
  
  for (const hunk of diff.hunks) {
    const lines = hunk.lines
    let i = 0
    
    while (i < lines.length) {
      const line = lines[i]
      
      if (line.type === DiffLineType.Delete) {
        // Check if next line is an addition (indicating a modification)
        if (i + 1 < lines.length && lines[i + 1].type === DiffLineType.Add) {
          const deletedLine = line
          const addedLine = lines[i + 1]
          const newLineNumber = addedLine.newLineNumber
          
          if (newLineNumber !== null) {
            lineChanges.set(newLineNumber, {
              type: 'modified',
              deletedContent: deletedLine.content,
            })
          }
          i += 2
        } else {
          // Pure deletion - we'll show it but it won't have a line number in new file
          i++
        }
      } else if (line.type === DiffLineType.Add) {
        const newLineNumber = line.newLineNumber
        if (newLineNumber !== null && !lineChanges.has(newLineNumber)) {
          lineChanges.set(newLineNumber, { type: 'added' })
        }
        i++
      } else {
        i++
      }
    }
  }

  // Also collect pure deletions to show them
  const deletions: IMarkdownDiffLine[] = []
  for (const hunk of diff.hunks) {
    const lines = hunk.lines
    let i = 0
    
    while (i < lines.length) {
      const line = lines[i]
      
      if (line.type === DiffLineType.Delete) {
        // Check if this is a pure deletion (not followed by an add)
        const isModification = i + 1 < lines.length && lines[i + 1].type === DiffLineType.Add
        if (!isModification) {
          deletions.push({
            type: 'deleted',
            content: line.content,
          })
        }
        i++
      } else {
        i++
      }
    }
  }

  // Build the result with all lines from the file
  const result: IMarkdownDiffLine[] = []
  
  for (let lineNum = 1; lineNum <= fileContents.length; lineNum++) {
    const content = fileContents[lineNum - 1]
    const change = lineChanges.get(lineNum)
    
    if (change) {
      result.push({
        type: change.type,
        content,
        deletedContent: change.deletedContent,
      })
    } else {
      result.push({
        type: 'context',
        content,
      })
    }
  }

  // Add deletions at the end (they don't have a position in the new file)
  result.push(...deletions)
  
  return result
}

/**
 * Fallback function that parses only the diff hunks when file contents are not available.
 */
function parseMarkdownDiffOnly(diff: ITextDiff): ReadonlyArray<IMarkdownDiffLine> {
  const result: IMarkdownDiffLine[] = []
  
  for (const hunk of diff.hunks) {
    const lines = hunk.lines
    let i = 0
    
    while (i < lines.length) {
      const line = lines[i]
      
      if (line.type === DiffLineType.Context) {
        result.push({
          type: 'context',
          content: line.content,
        })
        i++
      } else if (line.type === DiffLineType.Delete) {
        if (i + 1 < lines.length && lines[i + 1].type === DiffLineType.Add) {
          const deletedLine = line
          const addedLine = lines[i + 1]
          
          result.push({
            type: 'modified',
            content: addedLine.content,
            deletedContent: deletedLine.content,
          })
          i += 2
        } else {
          result.push({
            type: 'deleted',
            content: line.content,
          })
          i++
        }
      } else if (line.type === DiffLineType.Add) {
        result.push({
          type: 'added',
          content: line.content,
        })
        i++
      } else {
        i++
      }
    }
  }
  
  return result
}
