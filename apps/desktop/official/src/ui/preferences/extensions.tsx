import * as React from 'react'
import { DialogContent } from '../dialog'
import { Select } from '../lib/select'
import { TextBox } from '../lib/text-box'
import { Button } from '../lib/button'
import { Account, isDotComAccount } from '../../models/account'
import { getHTMLURL } from '../../lib/api'
import {
  t,
  getLanguagePreference,
  setLanguagePreference,
  languageAutonyms,
} from '@i18n'
import type { LanguagePreference } from '@i18n'

interface IExtensionsProps {
  /** All signed-in accounts; the first is the active one. */
  readonly accounts: ReadonlyArray<Account>
  /** Make the given account the active one (auth, API, commit identity). */
  readonly onSetActiveAccount: (account: Account) => void
  readonly onDotComSignIn: () => void
  readonly onEnterpriseSignIn: () => void
  readonly onLogout: (account: Account) => void
  readonly recentReposDisplayCount: number
  readonly onRecentReposDisplayCountChanged: (count: number) => void
}

/**
 * The fork's "Extensions" preferences tab: interface language and multi-account
 * management (switch the active account, add another, sign out).
 */
export class Extensions extends React.Component<IExtensionsProps, {}> {
  private onLanguageChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    void setLanguagePreference(event.currentTarget.value as LanguagePreference)
  }

  private onRecentReposCountInput = (value: string) => {
    const v = parseInt(value, 10)
    if (!isNaN(v) && v >= 1 && v <= 20) {
      this.props.onRecentReposDisplayCountChanged(v)
    }
  }

  private renderAccount(account: Account, isActive: boolean) {
    const host = isDotComAccount(account)
      ? 'GitHub.com'
      : new URL(getHTMLURL(account.endpoint)).host

    return (
      <div
        key={`${account.endpoint}|${account.id}`}
        className={`extensions-account${isActive ? ' is-active' : ''}`}
      >
        <img
          className="extensions-account-avatar"
          src={account.avatarURL}
          alt=""
          width={32}
          height={32}
        />
        <div className="extensions-account-info">
          <span className="extensions-account-login">
            {account.login}
            {isActive && (
              <span className="extensions-account-badge">{t('Active')}</span>
            )}
          </span>
          <span className="extensions-account-host">
            {account.name ? `${account.name} · ${host}` : host}
          </span>
        </div>
        <div className="extensions-account-actions">
          {!isActive && (
            <Button onClick={() => this.props.onSetActiveAccount(account)}>
              {t('Switch to this account')}
            </Button>
          )}
          <Button onClick={() => this.props.onLogout(account)}>
            {t('Sign out')}
          </Button>
        </div>
      </div>
    )
  }

  private renderAccounts() {
    const { accounts } = this.props

    return (
      <div className="extensions-section">
        <h2>{t('Accounts')}</h2>
        {accounts.length === 0 ? (
          <p>{t('No accounts signed in.')}</p>
        ) : (
          <div className="extensions-account-list">
            {accounts.map((account, index) =>
              this.renderAccount(account, index === 0)
            )}
          </div>
        )}
        <div className="extensions-account-add">
          <Button onClick={this.props.onDotComSignIn}>
            {t('Add another account')}
          </Button>
          <Button onClick={this.props.onEnterpriseSignIn}>
            {t('Add GitHub Enterprise account')}
          </Button>
        </div>
      </div>
    )
  }

  public render() {
    return (
      <DialogContent>
        {this.renderAccounts()}
        <div className="extensions-section">
          <h2>{t('Language')}</h2>
          <Select
            label={t('Interface language')}
            value={getLanguagePreference()}
            onChange={this.onLanguageChanged}
          >
            <option value="system">{t('Follow system')}</option>
            <option value="en-US">{languageAutonyms['en-US']}</option>
            <option value="zh-CN">{languageAutonyms['zh-CN']}</option>
          </Select>
          <TextBox
            label={t('Number of recent repositories')}
            value={String(this.props.recentReposDisplayCount)}
            onValueChanged={this.onRecentReposCountInput}
            placeholder="10"
          />
        </div>
      </DialogContent>
    )
  }
}
