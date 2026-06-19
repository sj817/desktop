import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'
import { encodePathAsUrl } from '../../lib/path'
import { Trans } from 'react-i18next'

const PaperStackImage = encodePathAsUrl(__dirname, 'static/paper-stack.svg')

interface ICICheckRunNoStepProps {
  /** Callback to opens check runs target url (maybe GitHub, maybe third party) */
  readonly onViewCheckExternally: () => void
}

/** The CI check no step view. */
export class CICheckRunNoStepItem extends React.PureComponent<ICICheckRunNoStepProps> {
  public render() {
    return (
      <div className="ci-check-run-no-steps">
        <p>
          <Trans i18nKey='ci-check-run-no-steps.no-steps'>
            There are no steps to display for this check.
            <Button
              className="button-with-icon"
              onClick={this.props.onViewCheckExternally}
              role="link"
            >
              View check details
              <Octicon symbol={octicons.linkExternal} />
            </Button>
          </Trans>
        </p>

        <img src={PaperStackImage} alt="" />
      </div>
    )
  }
}
