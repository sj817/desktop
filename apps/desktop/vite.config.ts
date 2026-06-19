import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import {
  existsSync,
  rmSync,
  cpSync,
  mkdirSync,
  statSync,
  createReadStream,
} from 'node:fs'

const resolvePath = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The official renderer's third-party deps now live in the workspace itself
// (declared in this package's package.json, installed flat via node-linker=hoisted
// at the workspace root). Previously this pointed at a junction into the legacy
// Electron app's node_modules; that dependency is gone.
const officialNodeModules = resolvePath('../../node_modules')

// Resolve webpack-style `~pkg` SCSS imports (e.g. ~primer-support/...) from the
// official node_modules, which Vite/sass don't understand natively.
const tildeImporter = {
  findFileUrl(url: string) {
    if (!url.startsWith('~')) {
      return null
    }
    return new URL(url.slice(1), pathToFileURL(officialNodeModules + '/'))
  },
}

// Allow running the dev server bound to a LAN host for Tauri mobile/dev.
const host = process.env.TAURI_DEV_HOST

// Recreates the webpack DefinePlugin constants the official source relies on
// (see app/app-info.ts). Platform flags are baked per build host, matching the
// official per-platform build model.
function officialGlobals(isDev: boolean) {
  return {
    __DARWIN__: JSON.stringify(process.platform === 'darwin'),
    __WIN32__: JSON.stringify(process.platform === 'win32'),
    __LINUX__: JSON.stringify(process.platform === 'linux'),
    __DEV__: JSON.stringify(isDev),
    __DEV_SECRETS__: JSON.stringify(isDev),
    __APP_NAME__: JSON.stringify('GitHub Desktop Next'),
    __APP_VERSION__: JSON.stringify('0.1.0'),
    __RELEASE_CHANNEL__: JSON.stringify(isDev ? 'development' : 'production'),
    __UPDATES_URL__: JSON.stringify(''),
    __SHA__: JSON.stringify('dev'),
    __OAUTH_CLIENT_ID__: JSON.stringify(
      process.env.DESKTOP_OAUTH_CLIENT_ID || 'de0e3c7e9973e1c4dd77'
    ),
    __OAUTH_SECRET__: JSON.stringify(
      process.env.DESKTOP_OAUTH_CLIENT_SECRET ||
        '1273305a5fc2737c2ca2911948ba24a9d961e2a3'
    ),
    __PROCESS_KIND__: JSON.stringify('ui'),
    'process.platform': JSON.stringify(process.platform),
    // Node globals the official renderer references at module load.
    __dirname: JSON.stringify('/'),
    __filename: JSON.stringify('/index.js'),
  }
}

// Flatten the official static assets into dist/static after a build so the
// flat runtime references (e.g. /static/welcome-illustration-right.svg) resolve
// over http. Mirrors upstream script/build.ts copyStaticResources: copy the
// platform-specific dir first, then common without overwriting.
function flattenOfficialStatic() {
  return {
    name: 'flatten-official-static',
    apply: 'build' as const,
    closeBundle() {
      const staticRoot = resolvePath('./official/static')
      const dest = resolvePath('./dist/static')
      rmSync(dest, { recursive: true, force: true })
      mkdirSync(dest, { recursive: true })
      const platformDir = `${staticRoot}/${process.platform}`
      if (existsSync(platformDir)) {
        cpSync(platformDir, dest, { recursive: true })
      }
      cpSync(`${staticRoot}/common`, dest, { recursive: true, force: false })

      // Emoji data + images live in the gemoji git submodule at the repo root
      // (github-desktop/gemoji), not under official/static. Upstream
      // script/build.ts copyEmoji() copies them next to index.html; here we put
      // them under /static so they resolve over http like every other asset
      // (see official/src/lib/read-emoji.ts). gemoji is two levels up from
      // apps/desktop (apps/desktop -> apps -> repo root).
      const gemojiRoot = resolvePath('../../gemoji')
      const emojiJson = `${gemojiRoot}/db/emoji.json`
      const emojiImages = `${gemojiRoot}/images/emoji`
      if (existsSync(emojiJson) && existsSync(emojiImages)) {
        cpSync(emojiJson, `${dest}/emoji.json`)
        cpSync(emojiImages, `${dest}/emoji`, { recursive: true })
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[flatten-official-static] gemoji assets not found at ${gemojiRoot}; ` +
            `emoji shortcodes will not render. Ensure the gemoji submodule is checked out.`
        )
      }
    },
  }
}

// Dev-server counterpart to flattenOfficialStatic: serve `/static/*` requests
// straight from official/static (platform dir first, then common) and the
// gemoji submodule, so `pnpm dev` shows the same assets the built dist would.
// Build mode flattens to dist/static instead, so this is `apply: 'serve'` only.
const STATIC_MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  json: 'application/json',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
}
function serveOfficialStaticDev() {
  const staticRoot = resolvePath('./official/static')
  const platformDir = `${staticRoot}/${process.platform}`
  const commonDir = `${staticRoot}/common`
  const gemojiRoot = resolvePath('../../gemoji')
  return {
    name: 'serve-official-static-dev',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url: string | undefined = req.url
        const path = url?.split('?')[0]
        if (!path || !path.startsWith('/static/')) {
          return next()
        }
        const rel = decodeURIComponent(path.slice('/static/'.length))
        // emoji.json + emoji images live in the gemoji submodule (see
        // flattenOfficialStatic); everything else is platform-then-common.
        const candidates: string[] = []
        if (rel === 'emoji.json') {
          candidates.push(`${gemojiRoot}/db/emoji.json`)
        } else if (rel.startsWith('emoji/')) {
          candidates.push(`${gemojiRoot}/images/${rel}`)
        }
        candidates.push(`${platformDir}/${rel}`, `${commonDir}/${rel}`)
        for (const file of candidates) {
          if (existsSync(file) && statSync(file).isFile()) {
            const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase()
            const mime = STATIC_MIME[ext]
            if (mime) {
              res.setHeader('Content-Type', mime)
            }
            createReadStream(file).pipe(res)
            return
          }
        }
        return next()
      })
    },
  }
}

// The syntax-highlighter worker loads CodeMirror modes, which `require` the full
// 'codemirror/lib/codemirror' — but that touches `document` and so can't run in
// a Web Worker. CodeMirror's runmode.node.js normally redirects that require to
// a DOM-free subset at RUNTIME via require.cache; that hack dies once bundled,
// so reproduce it at resolve time: any import of '.../lib/codemirror' coming
// from within codemirror resolves to runmode.node.js instead. The main renderer
// imports no CodeMirror, so this is scoped entirely to the worker's modes.
function codemirrorRunmodeRedirect() {
  return {
    name: 'codemirror-runmode-redirect',
    enforce: 'pre' as const,
    resolveId(source: string, importer: string | undefined) {
      // Only redirect imports of '.../lib/codemirror' that originate from inside
      // the codemirror package (the modes' and runmode.node's own require). Map
      // them to runmode.node.js (DOM-free). Derive the package root from the
      // importer path and return an absolute id directly — using this.resolve()
      // here deadlocks the worker build on the circular self-import.
      if (importer && /(^|[\\/])lib[\\/]codemirror(\.js)?$/.test(source)) {
        const norm = importer.replace(/\\/g, '/')
        const idx = norm.lastIndexOf('/codemirror/')
        if (idx !== -1) {
          const root = norm.slice(0, idx + '/codemirror'.length)
          return `${root}/addon/runmode/runmode.node.js`
        }
      }
      return null
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production'
  // The official GitHub Desktop renderer is now the primary build. Everything
  // specific to it is gated behind `official` so the legacy demo slice can still
  // be built/run via `--mode demo`. See docs/OFFICIAL_UI_PORT.md.
  const official = mode !== 'demo'

  return {
    plugins: [
      react(),
      // Also register the CodeMirror runmode redirect in the MAIN plugin list,
      // not just worker.plugins: Vite 8's dev server doesn't run worker.plugins
      // for module workers, so without this the highlighter worker imports the
      // DOM CodeMirror in dev and throws "document is not defined" (which used to
      // surface as a full-screen error overlay). Harmless on the main thread (it
      // imports no CodeMirror) and at build time (worker.plugins still applies).
      ...(official ? [codemirrorRunmodeRedirect()] : []),
      ...(official
        ? [
            nodePolyfills({
              // These are handled by our own stubs (see resolve.alias), so keep
              // the polyfill plugin from hijacking them with empty mocks.
              // `path` is excluded so our platform-aware (win32-on-Windows)
              // shim wins over path-browserify's POSIX-only implementation.
              exclude: ['fs', 'child_process', 'net', 'path'],
              globals: { Buffer: true, global: true, process: true },
              protocolImports: true,
            }),
            flattenOfficialStatic(),
            serveOfficialStaticDev(),
          ]
        : []),
    ],
    // Build official as production-like (__DEV__ false) to skip dev-only paths
    // that use webpack `require` (e.g. installDevGlobals).
    define: official ? officialGlobals(false) : {},
    resolve: {
      // Force a single copy of React across the app and its dependencies. The
      // dev dep-optimizer otherwise pre-bundles a second react-dom for
      // react-transition-group, so its findDOMNode (react-dom copy A) can't find
      // a node mounted by the app's react-dom (copy B) -> React #188 "Unable to
      // find node on an unmounted component". The bundled build dedupes via
      // Rollup automatically; the dev server needs this explicitly.
      dedupe: ['react', 'react-dom', 'react-transition-group'],
      alias: {
        '@locales': resolvePath('../../locales'),
        // Official source, physically copied into the repo (we own + sync it).
        '@official': resolvePath('./official/src'),
        // i18n runtime shared by the official renderer (t, language picker).
        '@i18n': resolvePath('./src/i18n/official.ts'),
        ...(official
          ? {
              // node-polyfills injects these shims into deps; pin them to the
              // workspace-root copy (flat node_modules) via absolute paths so
              // they resolve regardless of where a given dep sits in the tree.
              'vite-plugin-node-polyfills/shims/global': resolvePath(
                '../../node_modules/vite-plugin-node-polyfills/shims/global/dist/index.js'
              ),
              'vite-plugin-node-polyfills/shims/process': resolvePath(
                '../../node_modules/vite-plugin-node-polyfills/shims/process/dist/index.js'
              ),
              'vite-plugin-node-polyfills/shims/buffer': resolvePath(
                '../../node_modules/vite-plugin-node-polyfills/shims/buffer/dist/index.js'
              ),
              // Bridge electron -> Tauri so official renderer imports resolve.
              electron: resolvePath('./src/shims/electron.ts'),
              // Node built-ins with no webview equivalent -> clear-throw stubs.
              child_process: resolvePath('./src/shims/node-empty.ts'),
              net: resolvePath('./src/shims/node-empty.ts'),
              // 'fs/promises' must precede 'fs' (string aliases prefix-match).
              'fs/promises': resolvePath('./src/shims/native/fs-promises.ts'),
              fs: resolvePath('./src/shims/native/fs.ts'),
              // Platform-aware path (win32 on Windows) — the POSIX polyfill
              // mangles Windows absolute paths (resolve('/', 'D:/x') -> '/D:/x').
              path: resolvePath('./src/shims/native/path.ts'),
              // Native vendor packages -> stubs (real impls move to Rust commands).
              dugite: resolvePath('./src/shims/native/dugite.ts'),
              keytar: resolvePath('./src/shims/native/keytar.ts'),
              'fs-admin': resolvePath('./src/shims/native/fs-admin.ts'),
              'registry-js': resolvePath('./src/shims/native/registry-js.ts'),
              'desktop-notifications': resolvePath(
                './src/shims/native/desktop-notifications.ts'
              ),
              'desktop-trampoline': resolvePath(
                './src/shims/native/desktop-trampoline.ts'
              ),
              'windows-argv-parser': resolvePath(
                './src/shims/native/windows-argv-parser.ts'
              ),
              'process-proxy': resolvePath(
                './src/shims/native/process-proxy.ts'
              ),
              'electron-window-state': resolvePath(
                './src/shims/native/electron-window-state.ts'
              ),
              'app-path': resolvePath('./src/shims/native/app-path.ts'),
              'source-map-support': resolvePath(
                './src/shims/native/source-map-support.ts'
              ),
              '@github/copilot-sdk': resolvePath(
                './src/shims/native/copilot-sdk.ts'
              ),
            }
          : {}),
      },
    },
    // Official uses the root index.html (boots src/official.tsx). The legacy
    // demo slice builds from index.demo.html under `--mode demo`.
    publicDir: official ? false : 'public',
    build: official
      ? {
          // Use rolldown-vite's built-in minifier (oxc); avoids requiring the
          // optional `esbuild` package just for minification/worker transpile.
          minify: true,
          sourcemap: true,
        }
      : { rollupOptions: { input: resolvePath('./index.demo.html') } },
    css: official
      ? {
          preprocessorOptions: {
            scss: {
              loadPaths: [
                officialNodeModules,
                resolvePath('./official/styles'),
              ],
              importers: [tildeImporter],
              quietDeps: true,
              silenceDeprecations: [
                'import',
                'global-builtin',
                'color-functions',
                'legacy-js-api',
              ],
            },
          },
        }
      : {},
    // The syntax-highlighter worker (official/src/highlighter/index.ts) uses
    // dynamic import() to load CodeMirror modes on demand, which requires
    // code-splitting — so the worker must be emitted as ES modules (Vite's
    // default worker format is 'iife', which rejects code-splitting builds).
    worker: { format: 'es', plugins: () => [codemirrorRunmodeRedirect()] },
    clearScreen: false,
    server: {
      // Tauri's devUrl (tauri.conf.json) points here; keep them in lockstep.
      port: 1440,
      strictPort: true,
      host: host || false,
      // Never let a dev/HMR error paint a full-screen overlay over the app. A
      // transient worker or HMR hiccup must not "white-screen" the running app —
      // errors still log to the console. (Production has no overlay at all.)
      hmr: { overlay: false },
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
  }
})
