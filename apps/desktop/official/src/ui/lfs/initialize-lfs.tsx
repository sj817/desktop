import * as React from 'react'
import { t } from '@i18n'
import { Repository } from '../../models/repository'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { PathText } from '../lib/path-text'
import { LinkButton } from '../lib/link-button'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Trans } from 'react-i18next'

const LFSURL = 'https://git-lfs.github.com/'

/**
 * If we're initializing any more than this number, we won't bother listing them
 * all.
 */
const MaxRepositoriesToList = 10

interface IInitializeLFSProps {
  /** The repositories in which LFS needs to be initialized. */
  readonly repositories: ReadonlyArray<Repository>

  /**
   * Event triggered when the dialog is dismissed by the user in the
   * ways described in the Dialog component's dismissable prop.
   */
  readonly onDismissed: () => void

  /**
   * Called when the user chooses to initialize LFS in the repositories.
   */
  readonly onInitialize: (repositories: ReadonlyArray<Repository>) => void
}

export class InitializeLFS extends React.Component<IInitializeLFSProps, {}> {
  public render() {
    return (
      <Dialog
        id="initialize-lfs"
        title={t('Initialize Git LFS')}
        backdropDismissable={false}
        onSubmit={this.onInitialize}
        onDismissed={this.props.onDismissed}
      >
        <DialogContent>{this.renderRepositories()}</DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('Initialize Git LFS')}
            cancelButtonText={t(__DARWIN__ ? 'Not Now' : 'Not now')}
            onCancelButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onInitialize = () => {
    this.props.onInitialize(this.props.repositories)
    this.props.onDismissed()
  }

  private renderRepositories() {
    if (this.props.repositories.length > MaxRepositoriesToList) {
      const repositoryCount = this.props.repositories.length
      return (
        <p>
          <Trans i18nKey='initialize-lfs.many-repositories-use'>
            {{ repositoryCount }} repositories use{' '}
            <LinkButton uri={LFSURL}>Git LFS</LinkButton>. To contribute to
            them, Git LFS must first be initialized. Would you like to do so now?
          </Trans>
        </p>
      )
    } else {
      const plural = this.props.repositories.length !== 1
      return (
        <div>
          <p>
            {plural ? (
              <Trans i18nKey='initialize-lfs.repositories-use'>
                The repositories use{' '}
                <LinkButton uri={LFSURL}>Git LFS</LinkButton>. To contribute to
                them, Git LFS must first be initialized. Would you like to do so
                now?
              </Trans>
            ) : (
              <Trans i18nKey='initialize-lfs.repository-uses'>
                This repository uses{' '}
                <LinkButton uri={LFSURL}>Git LFS</LinkButton>. To contribute to
                it, Git LFS must first be initialized. Would you like to do so
                now?
              </Trans>
            )}
          </p>
          <ul>
            {this.props.repositories.map(r => (
              <li key={r.id}>
                <PathText path={r.path} />
              </li>
            ))}
          </ul>
        </div>
      )
    }
  }
}
