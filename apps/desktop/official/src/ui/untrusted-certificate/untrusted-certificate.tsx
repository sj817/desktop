import * as React from 'react'
import * as URL from 'url'
import { t } from '@i18n'
import { Trans } from 'react-i18next'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'

interface IUntrustedCertificateProps {
  /** The untrusted certificate. */
  readonly certificate: Electron.Certificate

  /** The URL which was being accessed. */
  readonly url: string

  /** The function to call when the user chooses to dismiss the dialog. */
  readonly onDismissed: () => void

  /**
   * The function to call when the user chooses to continue in the process of
   * trusting the certificate.
   */
  readonly onContinue: (certificate: Electron.Certificate) => void
}

/**
 * The dialog we display when an API request encounters an untrusted
 * certificate.
 *
 * An easy way to test this dialog is to attempt to sign in to GitHub
 * Enterprise using  one of the badssl.com domains, such
 * as https://self-signed.badssl.com/
 */
export class UntrustedCertificate extends React.Component<
  IUntrustedCertificateProps,
  {}
> {
  public render() {
    const host = URL.parse(this.props.url).hostname
    const subjectName = this.props.certificate.subjectName

    return (
      <Dialog
        title={t(__DARWIN__ ? 'Untrusted Server' : 'Untrusted server')}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onContinue}
        type={__DARWIN__ ? 'warning' : 'error'}
      >
        <DialogContent>
          <p>
            <Trans i18nKey='untrusted-certificate.cannot-verify'>
              GitHub Desktop cannot verify the identity of {{ host }}. The
              certificate ({{ subjectName }}) is invalid or untrusted.{' '}
              <strong>
                This may indicate attackers are trying to steal your data.
              </strong>
            </Trans>
          </p>
          <p>{t('In some cases, this may be expected. For example:')}</p>
          <ul>
            <li>{t('If this is a GitHub Enterprise trial.')}</li>
            <li>
              {t(
                'If your GitHub Enterprise instance is run on an unusual top-level domain.'
              )}
            </li>
          </ul>
          <p>
            {t(
              'If you are unsure of what to do, cancel and contact your system administrator.'
            )}
          </p>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={t(
              __DARWIN__ ? 'View Certificate' : 'Add certificate'
            )}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onContinue = () => {
    this.props.onDismissed()
    this.props.onContinue(this.props.certificate)
  }
}
