// HTML contextual (right-click) menu, styled to match the OFFICIAL app's menu.
// Official's right-click is a NATIVE Win11 Electron menu (menu.popup) — confirmed
// to have NO HTML/CSS source (not in the compiled renderer.css, not in the DOM on
// a real right-click). Tauri's own native menu (muda) renders MORE COMPACT than
// Electron's airy Win11 menu, so it can't match. So we reproduce the Win11 look in
// HTML, measured against a real screenshot of official 3.5.7: 14px font, ~30px
// rows, generous left padding, 8px rounded corners, and a Win11-style INSET light-
// grey rounded hover (NOT a full-width blue bar).
//
// Contract: input is the SERIALIZED item tree (actions stripped by the renderer),
// output is the selected index PATH (number[]) or null; official lib/menu-item.ts
// maps the path back to the real item and runs action(). `role` items (copy etc.)
// are executed here and resolve null.

interface CtxMenuItem {
  label?: string
  type?: 'separator' | 'checkbox'
  checked?: boolean
  enabled?: boolean
  role?: string
  accelerator?: string
  submenu?: ReadonlyArray<CtxMenuItem>
}

// Track the pointer (capture phase, before the React onContextMenu that calls us).
let lastPointer = { x: 0, y: 0 }
const trackPointer = (e: MouseEvent) => {
  lastPointer = { x: e.clientX, y: e.clientY }
}
window.addEventListener('pointerdown', trackPointer, true)
window.addEventListener('contextmenu', trackPointer, true)

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected) {
    return
  }
  stylesInjected = true
  const style = document.createElement('style')
  style.textContent = `
.gdctx-overlay { position: fixed; inset: 0; z-index: 2147483600; }
.gdctx {
  position: fixed;
  min-width: 180px;
  max-width: 420px;
  box-sizing: border-box;
  background: var(--background-color, #ffffff);
  color: var(--text-color, #1f2328);
  border: 1px solid var(--box-border-color, rgba(27,31,36,0.15));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(31,35,40,0.22);
  padding: 4px;
  /* Inherit the app's font stack (system-ui → Segoe UI Variable on Win11, the
     same font official's native menu uses; → 微软雅黑 for CJK). Forcing the old
     "Segoe UI" was the bug — different letterforms from Segoe UI Variable. */
  font-family: inherit;
  font-size: 12px;
  line-height: 1;
  user-select: none;
  overflow-y: auto;
  max-height: calc(100vh - 16px);
}
.gdctx-item {
  display: flex;
  align-items: center;
  height: 29px;
  padding: 0 12px 0 10px;
  border-radius: 4px;
  cursor: default;
  white-space: nowrap;
  min-width: 0;
}
.gdctx-check { width: 18px; flex-shrink: 0; text-align: center; font-size: 13px; }
.gdctx-label { flex: 1 1 auto; padding-left: 6px; overflow: hidden; text-overflow: ellipsis; }
.gdctx-acc { flex-shrink: 0; margin-left: 24px; color: var(--text-secondary-color, #6e7781); }
.gdctx-arrow { flex-shrink: 0; margin-left: 12px; opacity: 0.6; }
.gdctx-item.disabled { opacity: 0.4; }
.gdctx-item.selected:not(.disabled) {
  background: var(--box-selected-background-color, rgba(27,31,36,0.07));
}
.gdctx-sep { height: 1px; margin: 5px 6px; background: var(--box-border-color, rgba(27,31,36,0.15)); }
`
  document.head.appendChild(style)
}

function executeRole(role: string): void {
  const cmd: { [key: string]: string } = {
    copy: 'copy',
    cut: 'cut',
    paste: 'paste',
    selectAll: 'selectAll',
    undo: 'undo',
    redo: 'redo',
    delete: 'delete',
  }
  const c = cmd[role]
  if (c) {
    try {
      document.execCommand(c)
    } catch {
      /* best effort */
    }
  }
}

export function showHtmlContextMenu(
  items: ReadonlyArray<CtxMenuItem>,
  _addSpellCheckMenu = false
): Promise<ReadonlyArray<number> | null> {
  ensureStyles()
  document.querySelectorAll('.gdctx-overlay').forEach(el => el.remove())

  return new Promise<ReadonlyArray<number> | null>(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'gdctx-overlay'
    const panes: Array<HTMLElement> = []
    let settled = false

    const cleanup = () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onDismiss, true)
      document.removeEventListener('scroll', onDismiss, true)
      overlay.remove()
    }
    const settle = (value: ReadonlyArray<number> | null) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(value)
    }
    const onDismiss = () => settle(null)

    const placePane = (
      pane: HTMLElement,
      x: number,
      y: number,
      flipLeftOf?: number
    ) => {
      pane.style.left = '0px'
      pane.style.top = '0px'
      const rect = pane.getBoundingClientRect()
      let left = x
      let top = y
      if (left + rect.width > window.innerWidth - 4) {
        left =
          flipLeftOf !== undefined
            ? flipLeftOf - rect.width
            : window.innerWidth - rect.width - 4
      }
      if (top + rect.height > window.innerHeight - 4) {
        top = Math.max(4, window.innerHeight - rect.height - 4)
      }
      pane.style.left = `${Math.max(4, left)}px`
      pane.style.top = `${Math.max(4, top)}px`
    }

    const closePanesBelow = (depth: number) => {
      while (panes.length > depth + 1) {
        panes.pop()?.remove()
      }
    }

    const buildPane = (
      menuItems: ReadonlyArray<CtxMenuItem>,
      basePath: ReadonlyArray<number>,
      depth: number
    ): HTMLElement => {
      const pane = document.createElement('div')
      pane.className = 'gdctx'
      pane.setAttribute('role', 'menu')

      menuItems.forEach((item, index) => {
        if (item.type === 'separator') {
          const sep = document.createElement('div')
          sep.className = 'gdctx-sep'
          pane.appendChild(sep)
          return
        }
        const el = document.createElement('div')
        el.className = 'gdctx-item'
        el.setAttribute('role', 'menuitem')
        const disabled = item.enabled === false
        const hasSubmenu = !!item.submenu && item.submenu.length > 0
        if (disabled) {
          el.classList.add('disabled')
        }

        if (item.type === 'checkbox') {
          const check = document.createElement('span')
          check.className = 'gdctx-check'
          check.textContent = item.checked ? '✓' : ''
          el.appendChild(check)
        }

        const label = document.createElement('span')
        label.className = 'gdctx-label'
        label.textContent = (item.label ?? '').replace(/&([^&])/g, '$1')
        el.appendChild(label)

        if (item.accelerator) {
          const acc = document.createElement('span')
          acc.className = 'gdctx-acc'
          acc.textContent = item.accelerator
          el.appendChild(acc)
        }
        if (hasSubmenu) {
          const arrow = document.createElement('span')
          arrow.className = 'gdctx-arrow'
          arrow.textContent = '›'
          el.appendChild(arrow)
        }

        const path = [...basePath, index]

        el.addEventListener('mouseenter', () => {
          pane
            .querySelectorAll('.gdctx-item.selected')
            .forEach(n => n.classList.remove('selected'))
          el.classList.add('selected')
          closePanesBelow(depth)
          if (hasSubmenu && !disabled) {
            const r = el.getBoundingClientRect()
            const child = buildPane(item.submenu!, path, depth + 1)
            overlay.appendChild(child)
            panes[depth + 1] = child
            placePane(child, r.right - 2, r.top - 4, r.left + 2)
          }
        })

        el.addEventListener('mousedown', e => {
          e.stopPropagation()
        })

        if (!disabled && !hasSubmenu) {
          el.addEventListener('mouseup', e => {
            e.stopPropagation()
            if (item.role) {
              executeRole(item.role)
              settle(null)
            } else {
              settle(path)
            }
          })
        }

        pane.appendChild(el)
      })

      return pane
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        settle(null)
      }
    }

    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) {
        settle(null)
      }
    })

    document.body.appendChild(overlay)
    const root = buildPane(items, [], 0)
    overlay.appendChild(root)
    panes[0] = root
    placePane(root, lastPointer.x, lastPointer.y)

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onDismiss, true)
    document.addEventListener('scroll', onDismiss, true)
  })
}
