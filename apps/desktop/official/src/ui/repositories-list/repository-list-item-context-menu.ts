import { Repository } from '../../models/repository'
import { IMenuItem } from '../../lib/menu-item'
import { Repositoryish } from './group-repositories'
import { clipboard } from 'electron'
import { t } from '@i18n'
import {
  RevealInFileManagerLabel,
  DefaultEditorLabel,
  DefaultShellLabel,
} from '../lib/context-menu'
import { ICustomIntegration } from '../../lib/custom-integration'

interface IRepositoryListItemContextMenuConfig {
  repository: Repositoryish
  shellLabel: string | undefined
  externalEditorLabel: string | undefined
  askForConfirmationOnRemoveRepository: boolean
  onViewOnGitHub: (repository: Repositoryish) => void
  onOpenInShell: (repository: Repositoryish) => void
  onShowRepository: (repository: Repositoryish) => void
  onOpenInExternalEditor: (repository: Repositoryish) => void
  onRemoveRepository: (repository: Repositoryish) => void
  onChangeRepositoryAlias: (repository: Repository) => void
  onRemoveRepositoryAlias: (repository: Repository) => void
  onCreateWorktree?: (repository: Repository) => void
  onShowWorktrees?: (repository: Repository) => void
  customEditors: ReadonlyArray<ICustomIntegration>
  customShells: ReadonlyArray<ICustomIntegration>
  onOpenInCustomEditor: (
    repository: Repositoryish,
    editor: ICustomIntegration
  ) => void
  onOpenInCustomShell: (
    repository: Repositoryish,
    shell: ICustomIntegration
  ) => void
}

export const generateRepositoryListContextMenu = (
  config: IRepositoryListItemContextMenuConfig
) => {
  const { repository } = config
  const missing = repository instanceof Repository && repository.missing
  const github =
    repository instanceof Repository && repository.gitHubRepository != null
  const openInExternalEditor = config.externalEditorLabel
    ? t('Open in {{editorLabel}}', { editorLabel: config.externalEditorLabel })
    : DefaultEditorLabel()
  const openInShell = config.shellLabel
    ? t('Open in {{shellLabel}}', { shellLabel: config.shellLabel })
    : DefaultShellLabel()

  const items: ReadonlyArray<IMenuItem> = [
    ...buildAliasMenuItems(config),
    // Worktree items omitted to match official GitHub Desktop 3.5.7's repository
    // context menu (our synced upstream is newer and adds them). Re-add
    // `...buildWorktreeMenuItems(config),` here to restore worktree support.
    {
      label: t(__DARWIN__ ? 'Copy Repo Name' : 'Copy repo name'),
      action: () => clipboard.writeText(repository.name),
    },
    {
      label: t(__DARWIN__ ? 'Copy Repo Path' : 'Copy repo path'),
      action: () => clipboard.writeText(repository.path),
    },
    { type: 'separator' },
    {
      label: t('View on GitHub'),
      action: () => config.onViewOnGitHub(repository),
      enabled: github,
    },
    {
      label: openInShell,
      action: () => config.onOpenInShell(repository),
      enabled: !missing,
    },
    ...config.customShells.map(shell => ({
      label: t('Open in {{name}}', { name: shell.name }),
      action: () => config.onOpenInCustomShell(repository, shell),
      enabled: !missing,
    })),
    {
      label: RevealInFileManagerLabel(),
      action: () => config.onShowRepository(repository),
      enabled: !missing,
    },
    {
      label: openInExternalEditor,
      action: () => config.onOpenInExternalEditor(repository),
      enabled: !missing,
    },
    ...config.customEditors.map(editor => ({
      label: t('Open in {{name}}', { name: editor.name }),
      action: () => config.onOpenInCustomEditor(repository, editor),
      enabled: !missing,
    })),
    { type: 'separator' },
    {
      label: config.askForConfirmationOnRemoveRepository
        ? t(__DARWIN__ ? 'Remove…' : 'Remove…')
        : t('Remove'),
      action: () => config.onRemoveRepository(repository),
    },
  ]

  return items
}

const buildAliasMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository } = config

  if (!(repository instanceof Repository)) {
    return []
  }

  const verb = repository.alias == null ? t('Create') : t('Change')
  const items: Array<IMenuItem> = [
    {
      label: __DARWIN__
        ? t('{{verb}} Alias', { verb })
        : t('{{verb}} alias', { verb }),
      action: () => config.onChangeRepositoryAlias(repository),
    },
  ]

  if (repository.alias !== null) {
    items.push({
      label: t(__DARWIN__ ? 'Remove Alias' : 'Remove alias'),
      action: () => config.onRemoveRepositoryAlias(repository),
    })
  }

  return items
}

const buildWorktreeMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository, onCreateWorktree, onShowWorktrees } = config

  if (!(repository instanceof Repository)) {
    return []
  }

  if (onCreateWorktree === undefined && onShowWorktrees === undefined) {
    return []
  }

  const items: Array<IMenuItem> = []

  if (onShowWorktrees !== undefined) {
    items.push({
      label: t(__DARWIN__ ? 'Show Worktrees' : 'Show worktrees'),
      action: () => onShowWorktrees(repository),
    })
  }

  if (onCreateWorktree !== undefined) {
    items.push({
      label: t(__DARWIN__ ? 'New Worktree…' : 'New worktree…'),
      action: () => onCreateWorktree(repository),
    })
  }

  return items
}
