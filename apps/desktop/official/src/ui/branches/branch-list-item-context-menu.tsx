import { IMenuItem } from '../../lib/menu-item'
import { clipboard } from 'electron'
import { Branch, BranchType } from '../../models/branch'
import { t } from '@i18n'

interface IBranchContextMenuConfig {
  branch: Branch
  onRenameBranch?: (branchName: string) => void
  onViewBranchOnGitHub?: () => void
  onViewPullRequestOnGitHub?: () => void
  onDeleteBranch?: (branchName: string) => void
  onCheckoutInNewWorktree?: (branch: Branch) => void
}

export function generateBranchContextMenuItems(
  config: IBranchContextMenuConfig
): IMenuItem[] {
  const {
    branch,
    onRenameBranch,
    onViewBranchOnGitHub,
    onViewPullRequestOnGitHub,
    onDeleteBranch,
    onCheckoutInNewWorktree,
  } = config
  const items = new Array<IMenuItem>()

  if (onRenameBranch !== undefined) {
    items.push({
      label: t('Rename…'),
      action: () => onRenameBranch(branch.name),
      enabled: branch.type === BranchType.Local,
    })
  }

  items.push({
    label: t(__DARWIN__ ? 'Copy Branch Name' : 'Copy branch name'),
    action: () => clipboard.writeText(branch.name),
  })

  if (onViewBranchOnGitHub !== undefined) {
    items.push({
      label: t('View Branch on GitHub'),
      action: () => onViewBranchOnGitHub(),
    })
  }

  if (onViewPullRequestOnGitHub !== undefined) {
    items.push({
      label: t('View Pull Request on GitHub'),
      action: () => onViewPullRequestOnGitHub(),
    })
  }

  if (onCheckoutInNewWorktree !== undefined) {
    items.push({
      label: t(
        __DARWIN__ ? 'Checkout in New Worktree…' : 'Checkout in new worktree…'
      ),
      action: () => onCheckoutInNewWorktree(branch),
    })
  }

  items.push({ type: 'separator' })

  if (onDeleteBranch !== undefined) {
    items.push({
      label: t('Delete…'),
      action: () => onDeleteBranch(branch.name),
    })
  }

  return items
}
