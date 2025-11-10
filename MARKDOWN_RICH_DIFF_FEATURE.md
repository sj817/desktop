# Markdown Rich Diff Feature

## Summary

This feature adds the ability to view markdown files in a rich, rendered format within the diff view of GitHub Desktop. Users can toggle between "Code" view (the traditional view showing markdown syntax) and "Rich Diff" view (showing the rendered markdown) using a toggle button in the diff header.

## Implementation Details

### New Files Created

1. **`app/src/ui/lib/markdown-rich-diff-mode.tsx`** - Local storage utilities for the markdown rich diff preference
2. **`app/src/ui/diff/markdown-rich-diff.tsx`** - Component that renders markdown in rich format
3. **`app/src/ui/diff/markdown-diff-parser.ts`** - Parser to extract diff lines with markdown content
4. **`app/src/ui/diff/markdown-view-toggle.tsx`** - Toggle button component for switching views
5. **`app/src/lib/is-markdown-file.ts`** - Helper function to detect markdown files
6. **`app/styles/ui/_markdown-view-toggle.scss`** - Styles for the toggle button
7. **`app/styles/ui/_markdown-rich-diff.scss`** - Styles for the rich diff view

### Modified Files

1. **`app/src/lib/stores/app-store.ts`** - Added markdown rich diff as default preference to state
2. **`app/src/lib/app-state.ts`** - Added markdown rich diff preference to IAppState interface
3. **`app/src/ui/dispatcher/dispatcher.ts`** - Added dispatcher method for changing the preference
4. **`app/src/ui/preferences/preferences.tsx`** - Added preference props and state
5. **`app/src/ui/preferences/advanced.tsx`** - Added UI checkbox for the preference
6. **`app/src/ui/app.tsx`** - Passed preference to Preferences dialog
7. **`app/src/ui/changes/changes.tsx`** - Added markdown view mode state management
8. **`app/src/ui/diff/diff-header.tsx`** - Added markdown toggle rendering
9. **`app/src/ui/diff/seamless-diff-switcher.tsx`** - Added markdown view mode prop passing
10. **`app/src/ui/diff/index.tsx`** - Added logic to render rich diff for markdown
11. **`app/styles/_ui.scss`** - Imported new stylesheets

## Features

### User-Facing
- **Toggle Button**: When viewing a markdown file, a "Code" / "Rich Diff" toggle appears in the diff header with appropriate octicons
- **Rich Rendering**: In Rich Diff mode, each changed line is rendered as formatted markdown
- **Visual Differentiation**: Added, removed, and context lines are visually distinguished with colored borders
- **Preference Setting**: "Show markdown rich diff as default" checkbox in Preferences → Advanced

### Technical
- Uses `marked` library for markdown parsing and `DOMPurify` for sanitization
- Integrates with existing diff infrastructure
- Respects line-by-line diff structure
- State is managed per-file (switching files resets to default preference)
- Default preference persists across sessions via local storage

## Usage

1. Open a repository with markdown files in GitHub Desktop
2. Select a markdown file (`.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdown`) in the Changes view
3. Click the toggle buttons in the diff header to switch between Code and Rich Diff views
4. To set the default view, go to Preferences/Settings → Advanced → Check "Show markdown rich diff as default"

## Supported Markdown Files

The feature detects markdown files by extension:
- `.md`
- `.markdown`
- `.mdown`
- `.mkd`
- `.mkdown`

## Future Improvements

Potential enhancements not included in this implementation:
- Integrate emoji rendering (would require passing emoji map through props)
- Support for GitHub-specific markdown features (mentions, issue references)
- Side-by-side rich diff view
- Syntax highlighting within code blocks in the rich view
