# GitHub Desktop Next

A community-built, **unofficial** rebuild of [GitHub Desktop](https://github.com/desktop/desktop)
on a native [Tauri](https://tauri.app) (Rust) core instead of Electron — keeping the
familiar GitHub Desktop interface while shrinking the runtime and moving the heavy
lifting (Git, shell integration, credentials, filesystem) into Rust.

> **Not affiliated with GitHub, Inc.** This is an independent open-source fork. The
> name, logo, and "GitHub Desktop" UI originate from the upstream MIT-licensed
> project and remain the property of their respective owners. See
> [Attribution](#attribution).

> ⚠️ **Early stage.** This is an alpha-quality migration. Expect missing features and
> rough edges compared to the official Electron app.

---

## Why

- **Native, not Electron.** A Tauri shell uses the OS WebView instead of bundling
  Chromium, so installers and memory footprint are a fraction of the Electron build.
- **Rust where it matters.** Window controls, shell/editor integration, Git
  invocation, credential handling, and path resolution are implemented as
  cross-platform Rust commands.
- **Same UI you know.** The renderer is the upstream GitHub Desktop React UI, ported
  and synced into this repo (`apps/desktop/official`), driven through a thin
  Electron→Tauri bridge.

## Features

The current minimal-but-usable slice supports:

- Open a local Git repository via the native folder picker
- View the current branch, local branch list, working-tree status, and recent commits
- Reveal the repository in the file manager, refresh state
- Theme switching (system / light / dark)
- Language switching (English / 简体中文 / 日本語)
- App info (version, Git version, platform, architecture)

All Git, shell, window, and path operations are implemented natively in Rust and run
cross-platform on Windows, macOS, and Linux.

## Tech stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Shell    | Tauri 2 (Rust)                                        |
| Frontend | Vite + React 18 + react-i18next                       |
| UI       | Ported upstream GitHub Desktop renderer (`official/`) |
| Tooling  | pnpm 9 workspace, TypeScript, SCSS (Primer)           |

## Prerequisites

- **Node.js ≥ 20** and **pnpm ≥ 9**
- **Rust toolchain** (`cargo`, `rustc`) — only needed to run/build the desktop app
- **Platform Tauri dependencies:**
  - **Windows** — WebView2 (preinstalled on Win11), MSVC build tools
  - **macOS** — Xcode Command Line Tools
  - **Linux** — `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

## Getting started

```bash
git clone --recurse-submodules https://github.com/sj817/github-desktop-next.git
cd github-desktop-next
pnpm install

pnpm dev          # Vite frontend only (preview UI in a browser)
pnpm tauri:dev    # full native desktop app (needs the Rust toolchain)
```

> This repo uses a Git submodule (`gemoji`) for emoji assets — clone with
> `--recurse-submodules`, or run `git submodule update --init` afterwards.

### Common commands

```bash
pnpm dev          # Vite dev server (UI preview)
pnpm build        # type-check + build the frontend
pnpm typecheck    # type-check only
pnpm tauri:dev    # run the full Tauri desktop app
pnpm tauri:build  # build a desktop installer for the current OS
pnpm format       # Prettier
```

### Optional: OAuth configuration

Sign-in uses GitHub OAuth. To build with your own OAuth app credentials, set these
before building (they override the defaults baked into `vite.config.ts`):

```bash
DESKTOP_OAUTH_CLIENT_ID=...  DESKTOP_OAUTH_CLIENT_SECRET=...  pnpm tauri:build
```

## Building installers

Installers are produced per-OS (you can only build a platform's installer on that OS):

```bash
pnpm tauri:build                                  # current platform
pnpm tauri build --target aarch64-apple-darwin    # e.g. Apple Silicon
```

| OS      | Artifacts             |
| ------- | --------------------- |
| Windows | `.msi`, NSIS `.exe`   |
| macOS   | `.dmg`, `.app`        |
| Linux   | `.deb`, `.AppImage`, `.rpm` |

## Releases

Releases are built by CI. Push a version tag and the
[`release`](.github/workflows/release.yml) workflow builds Windows, macOS
(Apple Silicon + Intel), and Linux installers and attaches them to a GitHub Release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Project structure

```
.
├── apps/
│   └── desktop/
│       ├── src/            # Tauri app frontend (React 18, i18n, native shims)
│       ├── official/       # ported upstream GitHub Desktop renderer (synced)
│       ├── src-tauri/      # Rust backend (commands, window, git, shell)
│       └── git-credential-desktop/  # Git credential helper (Rust sidecar)
├── locales/                # shared i18n resources (en / zh / ja)
├── scripts/                # build helpers (icons, credential-helper staging)
└── pnpm-workspace.yaml
```

## Attribution

This project is a fork of [GitHub Desktop](https://github.com/desktop/desktop)
(© GitHub, Inc., MIT-licensed). The ported renderer under `apps/desktop/official`
and the UI assets derive from that upstream project. "GitHub" and the GitHub logo are
trademarks of GitHub, Inc.; their use here does not imply endorsement or affiliation.

## License

[MIT](LICENSE) — same as upstream GitHub Desktop.
