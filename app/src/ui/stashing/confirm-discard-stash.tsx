import * as React from 'react'
import { Repository } from '../../models/repository'
import { IStashEntry } from '../../models/stash-entry'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Row } from '../lib/row'

interface IConfirmDiscardStashProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly stash: IStashEntry
  readonly askForConfirmationOnDiscardStash: boolean
  readonly onDismissed: () => void
}

interface IConfirmDiscardStashState {
  readonly isDiscarding: boolean
  readonly confirmDiscardStash: boolean
}
/**
 * Dialog to confirm dropping a stash
 */
export class ConfirmDiscardStashDialog extends React.Component<
  IConfirmDiscardStashProps,
  IConfirmDiscardStashState
> {
  public constructor(props: IConfirmDiscardStashProps) {
    super(props)

    this.state = {
      isDiscarding: false,
      confirmDiscardStash: props.askForConfirmationOnDiscardStash,
    }
  }

  public render() {
    const title = __DARWIN__ ? 'Discard Stash?' : 'Discard stash?'

    return (
      <Dialog
        id="discard-stash"
        type="warning"
        title={title}
        loading={this.state.isDiscarding}
        disabled={this.state.isDiscarding}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        role="alertdialog"
        ariaDescribedBy="discard-stash-warning-message"
      >
        <DialogContent>
          <Row id="discard-stash-warning-message">
            Are you sure you want to discard these stashed changes?
          </Row>
          <Row>
            <Checkbox
              label="Do not show this message again"
              value={
                this.state.confirmDiscardStash
                  ? CheckboxValue.Off
                  : CheckboxValue.On
              }
              onChange={this.onAskForConfirmationOnDiscardStashChanged}
            />
          </Row>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup destructive={true} okButtonText="Discard" />
        </DialogFooter>
      </Dialog>
    )
  }

  private onAskForConfirmationOnDiscardStashChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = !event.currentTarget.checked

    this.setState({ confirmDiscardStash: value })
  }

  private onSubmit = async () => {
    const { dispatcher, repository, stash, onDismissed } = this.props

    this.setState({
      isDiscarding: true,
    })

    try {
      dispatcher.setConfirmDiscardStashSetting(this.state.confirmDiscardStash)
      await dispatcher.dropStash(repository, stash)
    } finally {
      this.setState({
        isDiscarding: false,
      })
    }

    onDismissed()
  }
}
