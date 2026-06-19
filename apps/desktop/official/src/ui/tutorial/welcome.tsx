import * as React from 'react'

import { encodePathAsUrl } from '../../lib/path'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

const CodeImage = encodePathAsUrl(__dirname, 'static/code.svg')
const TeamDiscussionImage = encodePathAsUrl(
  __dirname,
  'static/github-for-teams.svg'
)
const CloudServerImage = encodePathAsUrl(
  __dirname,
  'static/github-for-business.svg'
)

export class TutorialWelcome extends React.Component {
  public render() {
    return (
      <div id="tutorial-welcome">
        <div className="header">
          <h1>{t('Welcome to GitHub Desktop')}</h1>
          <p>
            {t(
              'Use this tutorial to get comfortable with Git, GitHub, and GitHub Desktop.'
            )}
          </p>
        </div>
        <ul className="definitions">
          <li>
            <img src={CodeImage} alt={t('Html syntax icon')} />
            <p>
              <Trans i18nKey='tutorial-welcome.git-definition'>
                <strong>Git</strong> is the version control system.
              </Trans>
            </p>
          </li>
          <li>
            <img
              src={TeamDiscussionImage}
              alt={t('People with discussion bubbles overhead')}
            />
            <p>
              <Trans i18nKey='tutorial-welcome.github-definition'>
                <strong>GitHub</strong> is where you store your code and
                collaborate with others.
              </Trans>
            </p>
          </li>
          <li>
            <img src={CloudServerImage} alt={t('Server stack with cloud')} />
            <p>
              <Trans i18nKey='tutorial-welcome.desktop-definition'>
                <strong>GitHub Desktop</strong> helps you work with GitHub
                locally.
              </Trans>
            </p>
          </li>
        </ul>
      </div>
    )
  }
}
