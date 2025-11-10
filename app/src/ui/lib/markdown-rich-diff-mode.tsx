import { getBoolean, setBoolean } from '../../lib/local-storage'

export const MarkdownRichDiffAsDefaultDefault = false
const markdownRichDiffAsDefaultKey = 'markdown-rich-diff-as-default'

/**
 * Gets a value indicating whether to present markdown diffs in a rich
 * rendered view by default as opposed to code view (the default).
 */
export function getMarkdownRichDiffAsDefault(): boolean {
  return getBoolean(markdownRichDiffAsDefaultKey, MarkdownRichDiffAsDefaultDefault)
}

/**
 * Sets a local storage key indicating whether to present markdown diffs in a
 * rich rendered view by default as opposed to code view (the default).
 */
export function setMarkdownRichDiffAsDefault(markdownRichDiffAsDefault: boolean) {
  setBoolean(markdownRichDiffAsDefaultKey, markdownRichDiffAsDefault)
}
