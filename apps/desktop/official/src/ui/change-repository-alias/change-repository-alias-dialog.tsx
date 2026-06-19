import * as React from 'react'
import { t } from '@i18n'

import { Dispatcher } from '../dispatcher'
import { nameOf, Repository } from '../../models/repository'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'

interface IChangeRepositoryAliasProps {
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
  readonly repository: Repository
}

interface IChangeRepositoryAliasState {
  readonly newAlias: string
}

export class ChangeRepositoryAlias extends React.Component<
  IChangeRepositoryAliasProps,
  IChangeRepositoryAliasState
> {
  public constructor(props: IChangeRepositoryAliasProps) {
    super(props)

    this.state = { newAlias: props.repository.alias ?? props.repository.name }
  }

  public render() {
    const repository = this.props.repository
    const verb = t(repository.alias === null ? 'Create' : 'Change')

    return (
      <Dialog
        id="change-repository-alias"
        title={t(
          __DARWIN__
            ? '{{verb}} Repository Alias'
            : '{{verb}} repository alias',
          { verb }
        )}
        ariaDescribedBy="change-repository-alias-description"
        onDismissed={this.props.onDismissed}
        onSubmit={this.changeAlias}
      >
        <DialogContent>
          <p id="change-repository-alias-description">
            {t('Choose a new alias for the repository "{{name}}". ', {
              name: nameOf(repository),
            })}
          </p>
          <p>
            <TextBox
              ariaLabel={t('Alias')}
              value={this.state.newAlias}
              onValueChanged={this.onNameChanged}
            />
          </p>
          {repository.gitHubRepository !== null && (
            <p className="description">
              {t('This will not affect the original repository name on GitHub.')}
            </p>
          )}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t(__DARWIN__ ? '{{verb}} Alias' : '{{verb}} alias', {
              verb,
            })}
            okButtonDisabled={this.state.newAlias.length === 0}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onNameChanged = (newAlias: string) => {
    this.setState({ newAlias })
  }

  private changeAlias = () => {
    this.props.dispatcher.changeRepositoryAlias(
      this.props.repository,
      this.state.newAlias
    )
    this.props.onDismissed()
  }
}
