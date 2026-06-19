// Compatibility shim so the official GitHub Desktop renderer (which imports from
// 'electron') resolves against Tauri. Aliased as `electron` in vite.config.ts.
// The renderer calls ipcRenderer.invoke(channel, ...positionalArgs); Tauri
// commands are snake_case and take a named object, so we map per channel.
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen, once as tauriOnce } from '@tauri-apps/api/event'
import { showHtmlContextMenu } from './html-context-menu'
import { parseAppURL } from '@official/lib/parse-app-url'

export interface IpcRendererEvent {
  sender: unknown
}

type Listener = (
  event: IpcRendererEvent,
  ...args: ReadonlyArray<unknown>
) => void

// --- Local event bus for events synthesized in the renderer. Upstream's main
// process pushes some events (notably the app menu over 'app-menu'); we emit
// those client-side. ---
const localListeners = new Map<string, Set<Listener>>()
let cachedAppMenu: unknown = null
// The raw FakeMenu (with each item's official click handler) backing the
// serialized app menu. Used to execute menu items by id (see invoke()).
let cachedElectronMenu: FakeMenu | null = null

function emitLocal(channel: string, payload: unknown) {
  localListeners.get(channel)?.forEach(l => l({ sender: null }, payload))
}

async function buildAndEmitAppMenu() {
  try {
    const { buildAppMenu, buildElectronMenu } = await import('./app-menu')
    cachedElectronMenu = buildElectronMenu() as FakeMenu
    cachedAppMenu = buildAppMenu()
    emitLocal('app-menu', cachedAppMenu)
  } catch (e) {
    console.warn('[electron-shim] failed to build app menu', e)
  }
}

// Depth-first search for a menu item by id in a FakeMenu tree.
function findMenuItemById(
  menu: FakeMenu | undefined,
  id: string
): FakeMenuItem | undefined {
  if (!menu) {
    return undefined
  }
  for (const item of menu.items) {
    if (item.id === id) {
      return item
    }
    const found = findMenuItemById(item.submenu, id)
    if (found) {
      return found
    }
  }
  return undefined
}

// Reproduces upstream's main-process behaviour of "clicking" a menu item: runs
// the item's official click handler with our fake focused window. The handler
// (build-default-menu.ts:emit / zoom) calls ipcWebContents.send(webContents,
// 'menu-event' | 'zoom-factor-changed', payload), which our fake webContents
// routes onto the local bus, where app.tsx's ipcRenderer.on('menu-event', ...)
// (and onMenuEvent) picks it up. This avoids a brittle id -> MenuEvent map and
// handles state-dependent names (push/force-push, show/hide stashed) for free.
function executeMenuItemById(id: string) {
  if (!cachedElectronMenu) {
    // The menu hasn't been built yet (renderer asked to execute before the
    // initial get-app-menu). Build it, then retry.
    void buildAndEmitAppMenu().then(() => runMenuItemClick(id))
    return
  }
  runMenuItemClick(id)
}

function runMenuItemClick(id: string) {
  const item = findMenuItemById(cachedElectronMenu ?? undefined, id)
  if (!item) {
    console.warn(`[electron-shim] execute-menu-item-by-id: unknown id '${id}'`)
    return
  }
  const click = item.click as
    | ((menuItem: unknown, focusedWindow: unknown) => void)
    | undefined
  if (typeof click !== 'function') {
    // Items without a click (roles like togglefullscreen) are not wired here.
    return
  }
  try {
    // Pass the fake focused window so `focusedWindow instanceof BrowserWindow`
    // is true and the handler emits via window.webContents.send.
    click(item, fakeFocusedWindow)
  } catch (e) {
    console.warn(`[electron-shim] menu item click failed for '${id}'`, e)
  }
}

// --- Minimal Electron Menu/MenuItem so the official menu definition
// (build-default-menu.ts) can build a menu that menuFromElectronMenu serializes
// into the IMenu the renderer's AppMenuBar consumes. ---
const ROLE_LABELS: Record<string, string> = {
  undo: '&Undo',
  redo: '&Redo',
  cut: 'Cu&t',
  copy: '&Copy',
  paste: '&Paste',
  selectAll: 'Select &all',
  delete: '&Delete',
  quit: 'E&xit',
  reload: '&Reload',
  forceReload: 'Force &reload',
  toggleDevTools: 'Toggle &developer tools',
  resetZoom: 'Actual &size',
  zoomIn: 'Zoom &in',
  zoomOut: 'Zoom &out',
  togglefullscreen: 'Toggle &full screen',
  minimize: 'Minimize',
  close: 'Close',
  about: 'About',
  services: 'Services',
  hide: 'Hide',
  hideOthers: 'Hide others',
  unhide: 'Show all',
}

const ROLE_ACCELERATORS: Record<string, string> = {
  undo: 'CmdOrCtrl+Z',
  redo: 'CmdOrCtrl+Y',
  cut: 'CmdOrCtrl+X',
  copy: 'CmdOrCtrl+C',
  paste: 'CmdOrCtrl+V',
  selectAll: 'CmdOrCtrl+A',
  reload: 'CmdOrCtrl+R',
  toggleDevTools: 'CmdOrCtrl+Shift+I',
  resetZoom: 'CmdOrCtrl+0',
  zoomIn: 'CmdOrCtrl+Plus',
  zoomOut: 'CmdOrCtrl+-',
  togglefullscreen: 'F11',
  minimize: 'CmdOrCtrl+M',
  close: 'CmdOrCtrl+W',
}

type MenuItemOptions = Record<string, unknown>

class FakeMenuItem {
  public id: string
  public label: string
  public type: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio'
  public accelerator: string | null
  public enabled: boolean
  public visible: boolean
  public checked: boolean
  public role?: string
  public submenu?: FakeMenu
  public click?: unknown

  public constructor(opts: MenuItemOptions) {
    const role = opts.role as string | undefined
    this.id = (opts.id as string) ?? role ?? 'unknown'
    this.role = role
    this.click = opts.click
    this.enabled = opts.enabled !== false
    this.visible = opts.visible !== false
    this.checked = opts.checked === true
    this.accelerator =
      (opts.accelerator as string) ??
      (role ? ROLE_ACCELERATORS[role] ?? null : null)
    this.label = (opts.label as string) ?? (role ? ROLE_LABELS[role] ?? '' : '')

    if (opts.submenu !== undefined) {
      this.submenu =
        opts.submenu instanceof FakeMenu
          ? opts.submenu
          : FakeMenu.buildFromTemplate(
              opts.submenu as ReadonlyArray<MenuItemOptions>
            )
      this.type = 'submenu'
    } else if (opts.type === 'separator') {
      this.type = 'separator'
    } else if (opts.type === 'checkbox' || opts.type === 'radio') {
      this.type = opts.type
    } else {
      this.type = 'normal'
    }
  }
}

class FakeMenu {
  public items: FakeMenuItem[] = []

  public append(item: FakeMenuItem) {
    this.items.push(item)
  }

  public static buildFromTemplate(template: ReadonlyArray<MenuItemOptions>) {
    const menu = new FakeMenu()
    for (const opts of template) {
      menu.items.push(new FakeMenuItem(opts))
    }
    return menu
  }
}

// Contextual (right-click) menu — HTML, styled to match the official app's native
// Win11 menu (see html-context-menu.ts). Tauri's native menu (muda) renders too
// compact vs Electron's airy menu, and official has no HTML/CSS source to copy
// (it's an OS-drawn native menu), so we reproduce the Win11 look in HTML. Same
// contract: resolves the selected index PATH (number[]) or null; the official
// lib/menu-item.ts maps the path back to the item and runs action().
async function showContextualMenu(
  items: unknown,
  addSpellCheckMenu: boolean
): Promise<ReadonlyArray<number> | null> {
  return showHtmlContextMenu(
    (items as ReadonlyArray<Parameters<typeof showHtmlContextMenu>[0][number]>) ??
      [],
    addSpellCheckMenu
  )
}

// channel -> { command, ordered snake_case param names } for implemented commands.
const COMMANDS: Record<
  string,
  { name: string; params: ReadonlyArray<string> }
> = {
  'get-path': { name: 'get_path', params: ['pathType'] },
  'get-app-architecture': { name: 'get_app_architecture', params: [] },
  'get-app-path': { name: 'get_app_path', params: [] },
  'get-exec-path': { name: 'get_exec_path', params: [] },
  'is-running-under-arm64-translation': {
    name: 'is_running_under_arm64_translation',
    params: [],
  },
  'is-in-application-folder': { name: 'is_in_application_folder', params: [] },
  'move-to-applications-folder': {
    name: 'move_to_applications_folder',
    params: [],
  },
  'get-apple-action-on-double-click': {
    name: 'get_apple_action_on_double_click',
    params: [],
  },
  'resolve-proxy': { name: 'resolve_proxy', params: ['url'] },
  'show-notification': {
    name: 'show_notification',
    params: ['title', 'body', 'userInfo'],
  },
  // The renderer announces readiness so Rust can flush any cold-start
  // `github <path>` CLI action (see commands/cli.rs).
  'renderer-ready': { name: 'renderer_ready', params: [] },
  'install-windows-cli': { name: 'install_windows_cli', params: [] },
  'uninstall-windows-cli': { name: 'uninstall_windows_cli', params: [] },
  'show-save-dialog': { name: 'show_save_dialog', params: ['options'] },
  'show-open-dialog': { name: 'show_open_dialog', params: ['options'] },
  'save-guid': { name: 'save_guid', params: ['guid'] },
  'get-guid': { name: 'get_guid', params: [] },
  'minimize-window': { name: 'minimize_window', params: [] },
  'maximize-window': { name: 'maximize_window', params: [] },
  'unmaximize-window': { name: 'unmaximize_window', params: [] },
  'close-window': { name: 'close_window', params: [] },
  'focus-window': { name: 'focus_window', params: [] },
  'quit-app': { name: 'quit_app', params: [] },
  'is-window-maximized': { name: 'is_window_maximized', params: [] },
  'get-current-window-state': { name: 'get_current_window_state', params: [] },
  'set-window-zoom-factor': {
    name: 'set_window_zoom_factor',
    params: ['zoomFactor'],
  },
  'update-window-background-color': {
    name: 'update_window_background_color',
    params: ['color'],
  },
  'move-to-trash': { name: 'move_to_trash', params: ['path'] },
  'show-item-in-folder': { name: 'show_item_in_folder', params: ['path'] },
  'open-external': { name: 'open_external', params: ['path'] },
  'unsafe-open-directory': { name: 'unsafe_open_directory', params: ['path'] },
  'should-use-dark-colors': { name: 'should_use_dark_colors', params: [] },
  'set-native-theme-source': {
    name: 'set_native_theme_source',
    params: ['themeName'],
  },
  // Documents the param mapping; the dedicated branch in invoke() intercepts
  // this channel first (the result is delivered asynchronously via an event).
  'show-contextual-menu': {
    name: 'show_contextual_menu',
    params: ['items', 'addSpellCheckMenu'],
  },
}

// Startup channels whose command is missing or not meaningful yet: return a safe
// default instead of calling Rust, so the shell can render.
const DEFAULTS: Record<string, () => unknown> = {
  'get-current-window-zoom-factor': () => 1,
  'is-window-focused': () => true,
  // Desktop grants notifications to the installed app (see notifications.rs).
  'get-notifications-permission': () => 'granted',
  'request-notifications-permission': () => true,
  // The app menu is built with fixed state (see app-menu.ts), so dynamic
  // enable/checked updates are graceful no-ops rather than unhandled warnings.
  'update-menu-state': () => undefined,
  'update-preferred-app-menu-item-labels': () => undefined,
  // Pure main-process notifications in upstream that have no Tauri-side work:
  // dialog open/close (used only to gate upstream's native menu) and pushing the
  // account list to the main process (for the tray/menu there). Graceful no-ops.
  // ('renderer-ready' is handled as a real command — see COMMANDS above.)
  'dialog-did-open': () => undefined,
  'update-accounts': () => undefined,
  // Telemetry is disabled in this fork (see lib/stats/stats-store.ts), so error
  // and crash reports are dropped rather than forwarded.
  'send-error-report': () => undefined,
  'uncaught-exception': () => undefined,
}

async function invoke(
  channel: string,
  ...args: ReadonlyArray<unknown>
): Promise<unknown> {
  if (channel === 'get-app-menu') {
    // Upstream's main process responds by pushing the menu over 'app-menu';
    // synthesize that here so the AppMenuBar (File/Edit/View/...) renders.
    void buildAndEmitAppMenu()
    return undefined
  }
  if (channel === 'execute-menu-item-by-id') {
    // Upstream's main process runs the menu item's .click() which emits a
    // 'menu-event' over IPC. The menu + click handlers live in the renderer
    // here, so run the click directly and emit onto the local bus. No Rust.
    executeMenuItemById(args[0] as string)
    return undefined
  }
  if (channel === 'show-contextual-menu') {
    // The native menu pops via Rust; the selected index path comes back over a
    // per-request event (see showContextualMenu). Resolves number[] | null.
    return showContextualMenu(args[0], args[1] === true)
  }
  if (channel === 'select-all-window-contents') {
    // Upstream calls webContents.selectAll() on the focused window. In the
    // webview the equivalent is selecting the whole document; the renderer only
    // falls back to this when no focused element handled its own select-all.
    document.execCommand('selectAll')
    return undefined
  }
  if (channel in DEFAULTS) {
    return DEFAULTS[channel]()
  }
  const cmd = COMMANDS[channel]
  if (!cmd) {
    console.warn(`[electron-shim] unhandled invoke channel: ${channel}`)
    return undefined
  }
  const payload: Record<string, unknown> = {}
  cmd.params.forEach((p, i) => {
    payload[p] = args[i]
  })
  try {
    return await tauriInvoke(cmd.name, payload)
  } catch (e) {
    console.warn(`[electron-shim] command failed: ${channel}`, e)
    return undefined
  }
}

export const ipcRenderer = {
  invoke,
  send: (channel: string, ...args: ReadonlyArray<unknown>) => {
    if (channel === 'log') {
      // eslint-disable-next-line no-console
      console.log('[renderer-log]', ...args)
      return
    }
    void invoke(channel, ...args)
  },
  sendSync: () => undefined,
  on: (channel: string, listener: Listener) => {
    let set = localListeners.get(channel)
    if (!set) {
      set = new Set()
      localListeners.set(channel, set)
    }
    set.add(listener)
    // Deliver an already-built app menu to a late subscriber.
    if (channel === 'app-menu' && cachedAppMenu) {
      setTimeout(() => listener({ sender: null }, cachedAppMenu), 0)
    }
    void listen(channel, event => {
      // Upstream's multi-arg IPC events (e.g. notification-event delivers
      // event, id, userInfo) map to a single Tauri payload we emit as an array;
      // spread it back into positional args for those listeners.
      if (channel === 'notification-event' && Array.isArray(event.payload)) {
        listener({ sender: null }, ...(event.payload as ReadonlyArray<unknown>))
      } else {
        listener({ sender: null }, event.payload)
      }
    })
  },
  once: (channel: string, listener: Listener) => {
    void tauriOnce(channel, event => listener({ sender: null }, event.payload))
  },
  removeListener: () => undefined,
  removeAllListeners: () => undefined,
}

// Bridge deep-link URLs (from Tauri's open-url event) to the renderer's
// url-action channel that the official sign-in flow listens on.
void listen<string>('open-url', event => {
  const url = event.payload
  if (typeof url === 'string' && url.length > 0) {
    const action = parseAppURL(url)
    const listeners = localListeners.get('url-action')
    if (listeners) {
      for (const listener of listeners) {
        listener({ sender: null }, action)
      }
    }
  }
})

export const clipboard = {
  writeText: (text: string) => navigator.clipboard?.writeText(text),
  readText: () => navigator.clipboard?.readText() ?? '',
}

export const shell = {
  openExternal: (url: string) =>
    tauriInvoke('open_external', { path: url }).then(() => true),
  openPath: (path: string) =>
    tauriInvoke('unsafe_open_directory', { path }).then(() => ''),
  showItemInFolder: (path: string) => {
    void tauriInvoke('show_item_in_folder', { path })
  },
  trashItem: (path: string) => tauriInvoke('move_to_trash', { path }),
}

export const webUtils = {
  getPathForFile: (file: File) =>
    (file as unknown as { path?: string }).path ?? '',
}

// Minimal main-process symbol stubs so the official menu definition builds and
// shared imports resolve. Only used to construct the menu structure; click
// handlers (which reference app/BrowserWindow/shell) never run in the renderer.
export const app = {
  getPath: () => '/',
  getAppPath: () => '/',
  getVersion: () => '0.1.0',
  getName: () => 'GitHub Desktop Next',
  name: 'GitHub Desktop Next',
}
// A fake WebContents whose send() routes to the local event bus, so official
// menu click handlers (emit/zoom) deliver their payloads to renderer listeners.
// zoomFactor/toggleDevTools/etc. are tolerant no-ops for the View menu items.
class FakeWebContents {
  public zoomFactor = 1
  public send(channel: string, ...sendArgs: ReadonlyArray<unknown>) {
    // Official senders pass a single payload arg (e.g. the MenuEvent name or
    // the new zoom factor); forward it bare to match ipcRenderer.on listeners.
    emitLocal(channel, sendArgs[0])
  }
  // ipc-webcontents.ts guards every send() with webContents.isDestroyed();
  // our synthetic window is never destroyed.
  public isDestroyed() {
    return false
  }
  public toggleDevTools() {
    void tauriInvoke('toggle_dev_tools')
  }
}

// Callable BrowserWindow so `x instanceof BrowserWindow` works in the official
// menu click handlers, and getAllWindows() yields a single fake window.
export class BrowserWindow {
  public readonly webContents = new FakeWebContents()
  public reload() {
    location.reload()
  }
  public static getFocusedWindow(): BrowserWindow | null {
    return fakeFocusedWindow
  }
  public static getAllWindows(): BrowserWindow[] {
    return [fakeFocusedWindow]
  }
}

const fakeFocusedWindow = new BrowserWindow()
export const Menu = {
  buildFromTemplate: (template: ReadonlyArray<MenuItemOptions>) =>
    FakeMenu.buildFromTemplate(template),
  setApplicationMenu: () => undefined,
  getApplicationMenu: () => null,
}
export const MenuItem = FakeMenuItem
export const ipcMain: unknown = undefined
export const dialog: unknown = undefined
export const net: unknown = undefined
export const nativeImage: unknown = undefined
export const WebContents: unknown = undefined

export default { ipcRenderer, clipboard, shell, webUtils }
