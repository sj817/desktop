import * as Path from 'path'

import { IMenuItem } from '../../lib/menu-item'
import { clipboard } from 'electron'
import { t } from '@i18n'

interface IWorktreeContextMenuConfig {
  readonly path: string
  readonly isMainWorktree: boolean
  readonly isLocked: boolean
  readonly onRenameWorktree?: (path: string) => void
  readonly onRemoveWorktree?: (path: string) => void
}

export function generateWorktreeContextMenuItems(
  config: IWorktreeContextMenuConfig
): ReadonlyArray<IMenuItem> {
  const { path, isMainWorktree, isLocked, onRenameWorktree, onRemoveWorktree } =
    config
  const name = Path.basename(path)
  const items = new Array<IMenuItem>()

  if (onRenameWorktree !== undefined) {
    items.push({
      label: t('Rename…'),
      action: () => onRenameWorktree(path),
      enabled: !isMainWorktree && !isLocked,
    })
  }

  items.push({
    label: t(__DARWIN__ ? 'Copy Worktree Name' : 'Copy worktree name'),
    action: () => clipboard.writeText(name),
  })

  items.push({
    label: t(__DARWIN__ ? 'Copy Worktree Path' : 'Copy worktree path'),
    action: () => clipboard.writeText(path),
  })

  items.push({ type: 'separator' })

  if (onRemoveWorktree !== undefined) {
    items.push({
      label: t('Delete…'),
      action: () => onRemoveWorktree(path),
      enabled: !isMainWorktree && !isLocked,
    })
  }

  return items
}
