import React from 'react'
import { parseRepositoryIdentifier } from '../../lib/remote-parsing'
import { ISubmoduleDiff } from '../../models/diff'
import { LinkButton } from '../lib/link-button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { SuggestedAction } from '../suggested-actions'
import { Ref } from '../lib/ref'
import { CopyButton } from '../copy-button'
import { shortenSHA } from '../../models/commit'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

type SubmoduleItemIcon =
  | {
      readonly octicon: typeof octicons.info
      readonly className: 'info-icon'
    }
  | {
      readonly octicon: typeof octicons.diffModified
      readonly className: 'modified-icon'
    }
  | {
      readonly octicon: typeof octicons.diffAdded
      readonly className: 'added-icon'
    }
  | {
      readonly octicon: typeof octicons.diffRemoved
      readonly className: 'removed-icon'
    }
  | {
      readonly octicon: typeof octicons.fileDiff
      readonly className: 'untracked-icon'
    }

interface ISubmoduleDiffProps {
  readonly onOpenSubmodule?: (fullPath: string) => void
  readonly diff: ISubmoduleDiff

  /**
   * Whether the diff is readonly, e.g., displaying a historical diff, or the
   * diff's content can be committed, e.g., displaying a change in the working
   * directory.
   */
  readonly readOnly: boolean
}

export class SubmoduleDiff extends React.Component<ISubmoduleDiffProps> {
  public constructor(props: ISubmoduleDiffProps) {
    super(props)
  }

  public render() {
    return (
      <div className="changes-interstitial submodule-diff">
        <div className="content">
          <div className="interstitial-header">
            <div className="text">
              <h1>{t('Submodule changes')}</h1>
            </div>
          </div>
          {this.renderSubmoduleInfo()}
          {this.renderCommitChangeInfo()}
          {this.renderSubmodulesChangesInfo()}
          {this.renderOpenSubmoduleAction()}
        </div>
      </div>
    )
  }

  private renderSubmoduleInfo() {
    if (this.props.diff.url === null) {
      return null
    }

    const repoIdentifier = parseRepositoryIdentifier(this.props.diff.url)
    if (repoIdentifier === null) {
      return null
    }

    const hostname =
      repoIdentifier.hostname === 'github.com'
        ? ''
        : ` (${repoIdentifier.hostname})`

    return this.renderSubmoduleDiffItem(
      { octicon: octicons.info, className: 'info-icon' },
      <Trans i18nKey='submodule-diff.based-on-repository'>
        This is a submodule based on the repository{' '}
        <LinkButton
          uri={`https://${repoIdentifier.hostname}/${repoIdentifier.owner}/${repoIdentifier.name}`}
        >
          {repoIdentifier.owner}/{repoIdentifier.name}
          {hostname}
        </LinkButton>
        .
      </Trans>
    )
  }

  private renderCommitChangeInfo() {
    const { diff, readOnly } = this.props
    const { oldSHA, newSHA } = diff

    const suffix = readOnly
      ? ''
      : ` ${t('This change can be committed to the parent repository.')}`

    if (oldSHA !== null && newSHA !== null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffModified, className: 'modified-icon' },
        <Trans i18nKey='submodule-diff.changed-commit'>
          This submodule changed its commit from{' '}
          {this.renderCommitSHA(oldSHA, 'previous')} to{' '}
          {this.renderCommitSHA(newSHA, 'new')}.{{suffix}}
        </Trans>
      )
    } else if (oldSHA === null && newSHA !== null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffAdded, className: 'added-icon' },
        readOnly ? (
          <Trans i18nKey='submodule-diff.added-readonly'>
            This submodule was added pointing at commit{' '}
            {this.renderCommitSHA(newSHA)}.{{suffix}}
          </Trans>
        ) : (
          <Trans i18nKey='submodule-diff.added'>
            This submodule has been added pointing at commit{' '}
            {this.renderCommitSHA(newSHA)}.{{suffix}}
          </Trans>
        )
      )
    } else if (oldSHA !== null && newSHA === null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffRemoved, className: 'removed-icon' },
        readOnly ? (
          <Trans i18nKey='submodule-diff.removed-readonly'>
            This submodule was removed while it was pointing at commit{' '}
            {this.renderCommitSHA(oldSHA)}.{{suffix}}
          </Trans>
        ) : (
          <Trans i18nKey='submodule-diff.removed'>
            This submodule has been removed while it was pointing at commit{' '}
            {this.renderCommitSHA(oldSHA)}.{{suffix}}
          </Trans>
        )
      )
    }

    return null
  }

  private renderCommitSHA(sha: string, which?: 'previous' | 'new') {
    const ariaLabel =
      which === 'previous'
        ? t('Copy the full previous SHA')
        : which === 'new'
        ? t('Copy the full new SHA')
        : t('Copy the full SHA')

    return (
      <>
        <Ref>{shortenSHA(sha)}</Ref>
        <CopyButton ariaLabel={ariaLabel} copyContent={sha} />
      </>
    )
  }

  private renderSubmodulesChangesInfo() {
    const { diff } = this.props

    if (!diff.status.untrackedChanges && !diff.status.modifiedChanges) {
      return null
    }

    const changesMessage =
      diff.status.untrackedChanges && diff.status.modifiedChanges
        ? t(
            'This submodule has modified and untracked changes. Those changes must be committed inside of the submodule before they can be part of the parent repository.'
          )
        : diff.status.untrackedChanges
        ? t(
            'This submodule has untracked changes. Those changes must be committed inside of the submodule before they can be part of the parent repository.'
          )
        : t(
            'This submodule has modified changes. Those changes must be committed inside of the submodule before they can be part of the parent repository.'
          )

    return this.renderSubmoduleDiffItem(
      { octicon: octicons.fileDiff, className: 'untracked-icon' },
      <>{changesMessage}</>
    )
  }

  private renderSubmoduleDiffItem(
    icon: SubmoduleItemIcon,
    content: React.ReactElement
  ) {
    return (
      <div className="item">
        <Octicon symbol={icon.octicon} className={icon.className} />
        <div className="content">{content}</div>
      </div>
    )
  }

  private renderOpenSubmoduleAction() {
    // If no url is found for the submodule, it means it can't be opened
    // This happens if the user is looking at an old commit which references
    // a submodule that got later deleted.
    if (this.props.diff.url === null) {
      return null
    }

    return (
      <span>
        <SuggestedAction
          title={t('Open this submodule on GitHub Desktop')}
          description={t(
            'You can open this submodule on GitHub Desktop as a normal repository to manage and commit any changes in it.'
          )}
          buttonText={t(__DARWIN__ ? 'Open Repository' : 'Open repository')}
          type="primary"
          onClick={this.onOpenSubmoduleClick}
        />
      </span>
    )
  }

  private onOpenSubmoduleClick = () => {
    this.props.onOpenSubmodule?.(this.props.diff.fullPath)
  }
}
