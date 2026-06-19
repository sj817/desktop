import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  OkCancelButtonGroup,
} from '../dialog'
import { LinkButton } from '../lib/link-button'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

interface ICopilotDisclaimerProps {
  /**
   * Invoked when the user clicks "I understand". Callers should record
   * the disclaimer-last-seen timestamp and trigger any follow-up action
   * (e.g. generating the commit message, starting conflict resolution).
   */
  readonly onAccepted: () => void

  /** Callback to use when the dialog gets closed. */
  readonly onDismissed: () => void
}

/**
 * Reusable AI-tool disclaimer popup shown the first time a user invokes
 * a Copilot-powered feature, and again every 30 days. Children are
 * slotted between the generic "Copilot is powered by AI, so mistakes
 * are possible." preamble and the "Learn more" link, e.g.
 *
 *   <CopilotDisclaimer onAccepted={…} onDismissed={…}>
 *     Review and edit the generated message carefully before use.
 *   </CopilotDisclaimer>
 *
 * The surrounding boilerplate (AI mistakes preamble + transparency
 * link) is provided here so all Copilot disclaimers stay consistent.
 */
export class CopilotDisclaimer extends React.Component<ICopilotDisclaimerProps> {
  public render() {
    const { children, onDismissed } = this.props
    return (
      <Dialog
        title={t('GitHub Copilot')}
        type="warning"
        onDismissed={onDismissed}
        onSubmit={this.onSubmit}
        ariaDescribedBy="copilot-disclaimer-body"
        role="alertdialog"
      >
        <DialogContent>
          <p id="copilot-disclaimer-body">
            <Trans i18nKey='copilot.disclaimer-body'>
              Copilot is powered by AI, so mistakes are possible.
              {children !== undefined && <> {children}</>}{' '}
              <LinkButton uri="https://gh.io/copilot-for-desktop-transparency">
                Learn more about Copilot in GitHub Desktop.
              </LinkButton>
            </Trans>
          </p>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={t('I understand')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSubmit = () => {
    this.props.onAccepted()
    this.props.onDismissed()
  }
}
