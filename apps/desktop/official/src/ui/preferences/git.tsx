import * as React from 'react'
import { t } from '@i18n'
import { Trans } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { DialogContent } from '../dialog'
import { RefNameTextBox } from '../lib/ref-name-text-box'
import { Ref } from '../lib/ref'
import { LinkButton } from '../lib/link-button'
import { Account } from '../../models/account'
import { GitConfigUserForm } from '../lib/git-config-user-form'
import { TabBar } from '../tab-bar'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Select } from '../lib/select'
import { TextBox } from '../lib/text-box'
import { Button } from '../lib/button'
import { Row } from '../lib/row'
import { showOpenDialog } from '../main-process-proxy'
import {
  shellFriendlyNames,
  SupportedHooksEnvShell,
} from '../../lib/hooks/config'

interface IGitProps {
  readonly name: string
  readonly email: string
  readonly defaultBranch: string
  readonly isLoadingGitConfig: boolean

  readonly accounts: ReadonlyArray<Account>

  readonly onNameChanged: (name: string) => void
  readonly onEmailChanged: (email: string) => void
  readonly onDefaultBranchChanged: (defaultBranch: string) => void

  readonly onEditGlobalGitConfig: () => void

  readonly selectedTabIndex?: number
  readonly onSelectedTabIndexChanged: (index: number) => void

  readonly onEnableGitHookEnvChanged: (enableGitHookEnv: boolean) => void
  readonly onCacheGitHookEnvChanged: (cacheGitHookEnv: boolean) => void
  readonly onSelectedShellChanged: (selectedShell: string) => void

  readonly enableGitHookEnv: boolean
  readonly cacheGitHookEnv: boolean
  readonly selectedShell: string
}

const windowsShells: ReadonlyArray<SupportedHooksEnvShell> = [
  'git-bash',
  'pwsh',
  'powershell',
  'cmd',
]

interface IGitState {
  readonly resolvedGitPath: string
  readonly customGitPath: string
  readonly gitPathStatus: 'idle' | 'saving' | 'saved' | 'error'
  readonly gitPathError: string
}

export class Git extends React.Component<IGitProps, IGitState> {
  public constructor(props: IGitProps) {
    super(props)
    this.state = {
      resolvedGitPath: '',
      customGitPath: '',
      gitPathStatus: 'idle',
      gitPathError: '',
    }
  }

  public componentDidMount() {
    this.loadGitPath()
  }

  private async loadGitPath() {
    try {
      const resolved = await invoke<string>('resolve_git_path')
      this.setState({ resolvedGitPath: resolved })
    } catch {
      this.setState({ resolvedGitPath: t('Not found') })
    }
  }

  private get selectedTabIndex() {
    return this.props.selectedTabIndex ?? 0
  }

  private onTabClicked = (index: number) => {
    this.props.onSelectedTabIndexChanged?.(index)
  }

  private onEnableGitHookEnvChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onEnableGitHookEnvChanged(event.currentTarget.checked)
  }

  private onCacheGitHookEnvChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onCacheGitHookEnvChanged(event.currentTarget.checked)
  }

  private onSelectedShellChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    this.props.onSelectedShellChanged(event.currentTarget.value)
  }

  private renderHooksSettings() {
    return (
      <>
        <Checkbox
          label={t('Load Git hook environment variables from shell')}
          ariaDescribedBy="git-hooks-env-description"
          value={
            this.props.enableGitHookEnv ? CheckboxValue.On : CheckboxValue.Off
          }
          onChange={this.onEnableGitHookEnvChanged}
        />
        <p id="git-hooks-env-description" className="settings-description">
          {t(
            'When enabled, GitHub Desktop will attempt to load environment variables from your shell when executing Git hooks. This is useful if your Git hooks depend on environment variables set in your shell configuration files, a common practice for version managers such as nvm, rbenv, asdf, etc.'
          )}
        </p>

        {this.props.enableGitHookEnv && __WIN32__ && (
          <>
            <Select
              className="git-hook-shell-select"
              label={t('Shell to use when loading environment')}
              value={this.props.selectedShell}
              onChange={this.onSelectedShellChanged}
            >
              {windowsShells
                .map(s => ({ key: s, title: shellFriendlyNames[s] }))
                .map(s => (
                  <option key={s.key} value={s.key}>
                    {s.title}
                  </option>
                ))}
            </Select>
          </>
        )}

        {this.props.enableGitHookEnv && (
          <>
            <Checkbox
              label={t('Cache Git hook environment variables')}
              ariaDescribedBy="git-hooks-cache-description"
              onChange={this.onCacheGitHookEnvChanged}
              value={
                this.props.cacheGitHookEnv
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
            />

            <div
              id="git-hooks-cache-description"
              className="settings-description"
            >
              {t(
                'Cache hook environment variables to improve performance. Disable if your hooks rely on frequently changing environment variables.'
              )}
            </div>
          </>
        )}
      </>
    )
  }

  public render() {
    return (
      <DialogContent className="git-preferences">
        <TabBar
          selectedIndex={this.selectedTabIndex}
          onTabClicked={this.onTabClicked}
        >
          <span>{t('Author')}</span>
          <span>{t('Default branch')}</span>
          <span>{t('Hooks')}</span>
          <span>{t('Git path')}</span>
        </TabBar>
        <div className="git-preferences-content">{this.renderCurrentTab()}</div>
      </DialogContent>
    )
  }

  private renderCurrentTab() {
    if (this.selectedTabIndex === 0) {
      return this.renderGitConfigAuthorInfo()
    } else if (this.selectedTabIndex === 1) {
      return this.renderDefaultBranchSetting()
    } else if (this.selectedTabIndex === 2) {
      return this.renderHooksSettings()
    } else if (this.selectedTabIndex === 3) {
      return this.renderGitPathSettings()
    }

    return null
  }

  private renderGitConfigAuthorInfo() {
    return (
      <>
        <GitConfigUserForm
          email={this.props.email}
          name={this.props.name}
          isLoadingGitConfig={this.props.isLoadingGitConfig}
          accounts={this.props.accounts}
          onEmailChanged={this.props.onEmailChanged}
          onNameChanged={this.props.onNameChanged}
        />
        {this.renderEditGlobalGitConfigInfo()}
      </>
    )
  }

  private renderDefaultBranchSetting() {
    return (
      <div className="default-branch-component">
        <h2 id="default-branch-heading">
          {t('Default branch name for new repositories')}
        </h2>

        <RefNameTextBox
          initialValue={this.props.defaultBranch}
          onValueChange={this.props.onDefaultBranchChanged}
          ariaLabelledBy={'default-branch-heading'}
          ariaDescribedBy="default-branch-description"
          warningMessageVerb="saved"
        />

        <p id="default-branch-description" className="settings-description">
          <Trans i18nKey='git.default-branch-description'>
            GitHub's default branch name is <Ref>main</Ref>. You may want to
            change it due to different workflows, or because your integrations
            still require the historical default branch name of <Ref>master</Ref>
            .
          </Trans>
        </p>

        {this.renderEditGlobalGitConfigInfo()}
      </div>
    )
  }

  private renderGitPathSettings() {
    const { resolvedGitPath, customGitPath, gitPathStatus, gitPathError } =
      this.state
    const gitFound = resolvedGitPath && resolvedGitPath !== t('Not found')
    return (
      <div className="advanced-section">
        <div className="git-status-row">
          <span className={`git-status-dot ${gitFound ? 'found' : 'missing'}`} />
          <span className="git-status-label">{t('Git status: ')}</span>
          <span className="git-status-value" style={{ userSelect: 'text' }}>
            {gitFound
              ? t('Detected ({{path}})', { path: resolvedGitPath })
              : t('Not found')}
          </span>
        </div>

        <div className="custom-integration-form-container">
          <div className="custom-integration-form-path-container">
            <TextBox
              label={t('Custom Git path')}
              value={customGitPath}
              onValueChanged={v => this.setState({
                customGitPath: v,
                gitPathStatus: 'idle',
                gitPathError: '',
              })}
              placeholder={t('Leave empty to use system default')}
            />
            <Button onClick={this.onChooseGitPath}>{t('Choose…')}</Button>
          </div>
        </div>

        <p className="settings-description">
          {t('Specify a custom Git executable. Leave empty to use the version found on your system PATH.')}
        </p>

        <Row>
          <Button onClick={this.onSaveGitPath}>{t('Save')}</Button>
          <Button onClick={this.onResetGitPath}>{t('Reset to default')}</Button>
        </Row>

        {gitPathStatus === 'saved' && (
          <p className="settings-description">
            ✓ {t('Git path saved successfully.')}
          </p>
        )}
        {gitPathStatus === 'error' && (
          <p className="settings-description" style={{ color: 'var(--error-color)' }}>
            {gitPathError}
          </p>
        )}
      </div>
    )
  }

  private onChooseGitPath = async () => {
    const path = await showOpenDialog({
      properties: ['openFile'],
      filters: __WIN32__
        ? [{ name: 'Executables', extensions: ['exe'] }]
        : undefined,
    })
    if (path) {
      this.setState({ customGitPath: path, gitPathStatus: 'idle', gitPathError: '' })
    }
  }

  private onSaveGitPath = async () => {
    const { customGitPath } = this.state
    this.setState({ gitPathStatus: 'saving' })
    try {
      await invoke('set_custom_git_path', {
        path: customGitPath || null,
      })
      await this.loadGitPath()
      this.setState({ gitPathStatus: 'saved' })
    } catch (e) {
      this.setState({
        gitPathStatus: 'error',
        gitPathError: String(e),
      })
    }
  }

  private onResetGitPath = async () => {
    this.setState({ customGitPath: '', gitPathStatus: 'saving' })
    try {
      await invoke('set_custom_git_path', { path: null })
      await this.loadGitPath()
      this.setState({ gitPathStatus: 'saved' })
    } catch (e) {
      this.setState({
        gitPathStatus: 'error',
        gitPathError: String(e),
      })
    }
  }

  private renderEditGlobalGitConfigInfo() {
    return (
      <p className="settings-description">
        <Trans i18nKey='git.edit-global-config-description'>
          These preferences will{' '}
          <LinkButton onClick={this.props.onEditGlobalGitConfig}>
            edit your global Git config file
          </LinkButton>
          .
        </Trans>
      </p>
    )
  }
}
