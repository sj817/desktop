// WebView2 (unlike Electron) shows its own default browser context menu on
// right-click — and Tauri leaves it enabled in debug builds for devtools. The
// official renderer relies on Electron having NO default context menu and shows
// its own menus explicitly via showContextualMenu (repository list, branch
// button, diffs, …). Without this, right-clicking surfaces the WebView2 menu
// (Reload/Inspect/…), which looks nothing like the app's menus.
//
// Suppress the default everywhere. The app's React `onContextMenu` handlers
// still run (this only cancels the browser's own menu), so showContextualMenu
// keeps working. Devtools stay reachable via Ctrl+Shift+I.
window.addEventListener('contextmenu', event => {
  event.preventDefault()
})

export {}
