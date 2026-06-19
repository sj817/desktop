// Work-in-progress entry that boots the official GitHub Desktop renderer under
// Vite + Tauri. Built in isolation via `pnpm build:official` so the default app
// stays green. The official renderer self-mounts into #desktop-app-container.
// Excluded from tsc (the official source is type-checked by the legacy build).
// See docs/OFFICIAL_UI_PORT.md for the port status and remaining blockers.
// Must precede the official renderer: restores process.platform (see the shim)
// so the platform-* body class and win32 CSS apply before index.tsx runs.
import './shims/set-process-platform'
// Suppress WebView2's default browser context menu so only the app's own menus
// (showContextualMenu) appear, matching official.
import './shims/suppress-browser-context-menu'
import '@official/ui/index'
