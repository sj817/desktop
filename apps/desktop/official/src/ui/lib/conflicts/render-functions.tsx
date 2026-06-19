import * as React from 'react'
import { t } from '@i18n'
import { Trans } from 'react-i18next'
import { Octicon } from '../../octicons'
import * as octicons from '../../octicons/octicons.generated'
import { LinkButton } from '../link-button'

export function renderUnmergedFilesSummary(conflictedFilesCount: number) {
  // localization, it burns :vampire:
  const message =
    conflictedFilesCount === 1
      ? t('{{conflictedFilesCount}} conflicted file', { conflictedFilesCount })
      : t('{{conflictedFilesCount}} conflicted files', { conflictedFilesCount })
  return <h2 className="summary">{message}</h2>
}

export function renderAllResolved() {
  return (
    <div className="all-conflicts-resolved">
      <div className="green-circle">
        <Octicon symbol={octicons.check} />
      </div>
      <div className="message">{t('All conflicts resolved')}</div>
    </div>
  )
}

export function renderShellLink(openThisRepositoryInShell: () => void) {
  return (
    <div>
      <Trans i18nKey='render-functions.open-in-command-line'>
        <LinkButton onClick={openThisRepositoryInShell}>
          Open in command line,
        </LinkButton>{' '}
        your tool of choice, or close to resolve manually.
      </Trans>
    </div>
  )
}
