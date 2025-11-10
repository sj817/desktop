/**
 * Checks if a file path represents a markdown file based on its extension.
 */
export function isMarkdownFile(path: string): boolean {
  const lowerPath = path.toLowerCase()
  return (
    lowerPath.endsWith('.md') ||
    lowerPath.endsWith('.markdown') ||
    lowerPath.endsWith('.mdown') ||
    lowerPath.endsWith('.mkd') ||
    lowerPath.endsWith('.mkdown')
  )
}
