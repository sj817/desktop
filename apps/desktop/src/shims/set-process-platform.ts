// vite-plugin-node-polyfills' `process` shim is a bare object that omits
// `platform`, and under Vite 8 the `define` for `process.platform` no longer
// rewrites member access through that shim — so `process.platform` is
// `undefined` at runtime. That breaks the `platform-<os>` class set on <body>
// (so every `@include win32` CSS rule — including the title-bar background —
// never applies, leaving the app menu bar's white text on an unstyled/transparent
// title bar, i.e. invisible) and every editor/shell platform check.
//
// The build is static per target OS, so restore it from the build-time platform
// flags. Referencing the bare `process` makes node-polyfills inject the same
// shim singleton the official code sees, so this mutation is shared everywhere.
// This MUST run before the official renderer module evaluates (index.tsx sets the
// `platform-*` body class at module load), which is why official.tsx imports it
// first.
declare const __WIN32__: boolean
declare const __DARWIN__: boolean
declare const process: { platform?: string }

if (typeof process !== 'undefined' && !process.platform) {
  process.platform = __WIN32__ ? 'win32' : __DARWIN__ ? 'darwin' : 'linux'
}

export {}
