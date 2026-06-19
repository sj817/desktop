// CodeMirror's `runmode.node.js` (a Node-targeted module that index.ts imports)
// ends with a Node-only line:
//   require.cache[require.resolve("./runmode.node")] =
//     require.cache[require.resolve("../../addon/runmode/runmode")]
// The bundler statically rewrites the plain `require("...")` calls but cannot
// rewrite `require.cache` / `require.resolve`, so they survive into this ESM
// worker where `require` is undefined — throwing "require is not defined" the
// first time a CodeMirror mode loads, which silently disables all syntax
// highlighting. Provide a harmless `require` shim (the cache line is a no-op
// outside Node) so mode loading succeeds. This module is imported FIRST by the
// worker entry (index.ts) and only ever runs inside the highlighter worker.
const globalScope = globalThis as unknown as { require?: unknown }

if (globalScope.require === undefined) {
  const shim = (() => ({})) as unknown as {
    (id: string): unknown
    cache: Record<string, unknown>
    resolve: (id: string) => string
  }
  shim.cache = {}
  shim.resolve = (id: string) => id
  globalScope.require = shim
}

export {}
