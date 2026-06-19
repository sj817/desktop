# 同步上游（Syncing Upstream）

本仓库是 [GitHub Desktop](https://github.com/desktop/desktop) 的社区 fork。官方 React
前端被**物理拷贝**进 `apps/desktop/official/`，本文件说明如何把上游的更新同步进来。

> 这套流程**取代**了旧的 `FORK_SYNC.md`（那套基于 `git merge upstream/development`、
> 依赖 legacy Electron 树与 `desktop-next/` 并存的方案）。本仓库已扁平化并以 orphan 单
> 提交起步，与上游**没有共同 git 历史**，因此无法用 merge 同步——同步等于刷新被 vendored
> 的 `official/` 拷贝。

---

## 1. 核心模型

- `apps/desktop/official/src` ← 拷贝自上游 `app/src`（官方渲染层：`ui/` + `lib/` 等）
- `apps/desktop/official/styles` ← 拷贝自上游 `app/styles`
- 这两个目录是**上游的镜像**，原则上**只接收上游、不手改**。
- 所有让官方代码跑在 Tauri 上的**适配**都放在 `official/` 之外，这样上游覆盖拷贝时不冲突：
  - `apps/desktop/src/shims/`——electron / node / 原生模块的垫片
  - `apps/desktop/vite.config.ts`——`define` 全局常量 + `resolve.alias` 别名
  - `apps/desktop/package.json`——官方渲染层用到的 npm 依赖
- Rust 后端（`apps/desktop/src-tauri/`）与 i18n（`locales/`、`src/i18n/`）是 fork 自有，
  与上游无关，同步时不动。

## 2. 当前基线

| 项 | 值 |
| --- | --- |
| 上游版本 | `3.5.12-beta2` |
| 上游 commit | `62c0fdf45a` |

> 每次同步后更新本表。

## 3. 前置：配置 upstream remote

```bash
git remote add upstream https://github.com/desktop/desktop.git   # 若尚未配置
git fetch upstream --tags
```

## 4. 同步步骤

### 4.1 选定目标上游版本

```bash
git fetch upstream --tags
git tag --list 'release-3.*' | sort -V | tail -5      # 看最新 release tag
```

### 4.2 用上游该版本覆盖 `official/`

用 `git archive` 从上游 tag 抽出子树（不需要切换分支/工作区），覆盖到 `official/`。
**先删后拷**，这样上游删除的文件也会被正确移除：

```bash
TAG=release-3.5.13            # 改成目标 tag

# 抽出上游该版本的 app/src 与 app/styles 到临时目录
rm -rf /tmp/up && mkdir -p /tmp/up
git archive "upstream/$TAG" app/src app/styles | tar -x -C /tmp/up

# 覆盖到 official（保留内部相对引用，目录结构与上游一致）
rm -rf apps/desktop/official/src apps/desktop/official/styles
cp -r /tmp/up/app/src    apps/desktop/official/src
cp -r /tmp/up/app/styles apps/desktop/official/styles
```

> `static/`（图片等静态资源）默认不在此流程内；当前 `official/static` 是按需补充的。
> 上游若新增运行期引用的静态资源，按需用同样方式从 `app/static` 取。

### 4.3 审查差异

```bash
git status
git diff --stat apps/desktop/official
```

重点看：是否出现**新的裸 import**（上游引入了新依赖或新的原生模块）。

### 4.4 构建验证 + 补适配

```bash
pnpm install        # 若 4.4 要加依赖，先改 package.json 再装
pnpm build          # 前端构建必须通过
```

构建若报 `failed to resolve import "<x>"`，按 `<x>` 的性质补适配（**不要改 official/**）：

| `<x>` 的类型 | 处理 | 例子 |
| --- | --- | --- |
| 纯 JS npm 包 | 加进 `apps/desktop/package.json` 依赖 | `parse-dds` |
| 原生 / 仅主进程模块（无 webview 等价物） | 在 `src/shims/native/` 写桩 + 在 `vite.config.ts` 加 `alias` | `process-proxy`、`electron-window-state`、`dugite`、`keytar` |
| Node 内置 | 多数由 `vite-plugin-node-polyfills` 兜住；`fs`/`child_process`/`net`/`path` 已有专门 shim | — |

> 快速找出所有未解析的裸 import：遍历 `official/src` 的 import，排除 node 内置、已 `alias`
> 的、已声明依赖的，剩下的就是要处理的。

完整跑一遍打包以确认 Rust/打包侧也 OK：

```bash
pnpm tauri:build
```

### 4.5 更新基线并提交

- 更新本文件「当前基线」表（版本 + commit）。
- 提交：`official/` 的上游变更 + 适配（shim/alias/dep）+ 基线更新，最好放同一个提交或
  紧邻的两个提交，便于回溯「这次同步带来了什么」。

## 5. 已知适配点（速查）

- 全局常量（官方 `app-info.ts` 的 webpack DefinePlugin）：见 `vite.config.ts` 的
  `officialGlobals()`（`__DARWIN__`、`__APP_VERSION__`、`__OAUTH_CLIENT_ID__` 等）。
- electron 桥接：`src/shims/electron.ts`（`ipcRenderer`/`clipboard`/`shell`/`webUtils`）。
- 原生模块桩：`src/shims/native/*`（`dugite`、`keytar`、`registry-js`、`fs-admin`、
  `desktop-notifications`、`desktop-trampoline`、`windows-argv-parser`、`process-proxy`、
  `electron-window-state`、`app-path`、`source-map-support`）。
- node 内置：`fs`、`fs/promises`、`path` 有平台感知 shim；`child_process`/`net` 走
  `node-empty.ts`；其余由 `vite-plugin-node-polyfills` 提供。
- 依赖布局：`node-linker=hoisted`（见 `.npmrc`），让官方渲染层直接 import 的传递依赖
  （`semver`、`focus-trap` 等）与 Primer SCSS 的 `~pkg` 导入能在扁平 `node_modules` 解析。
