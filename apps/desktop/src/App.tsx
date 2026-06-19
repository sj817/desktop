import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { changeLanguage, supportedLanguages } from './i18n'
import type { LanguageCode } from './i18n'
import { api } from './lib/api'
import type { CommitInfo, StatusEntry, ThemeSource } from './lib/api'

interface RepoState {
  path: string
  branch: string
  branches: ReadonlyArray<string>
  status: ReadonlyArray<StatusEntry>
  commits: ReadonlyArray<CommitInfo>
}

function applyTheme(theme: ThemeSource) {
  const root = document.documentElement
  if (theme === 'system') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = theme
  }
}

function App() {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useState<ThemeSource>('system')
  const [repo, setRepo] = useState<RepoState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [appVersion, setAppVersion] = useState('…')
  const [gitVersion, setGitVersion] = useState('…')
  const [platform, setPlatform] = useState('…')
  const [arch, setArch] = useState('…')

  useEffect(() => {
    api
      .appVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion('unknown'))
    api
      .platform()
      .then(setPlatform)
      .catch(() => setPlatform('unknown'))
    api
      .architecture()
      .then(setArch)
      .catch(() => setArch('unknown'))
    api
      .gitVersion()
      .then(setGitVersion)
      .catch(() => setGitVersion('unavailable'))
  }, [])

  const onThemeChange = (next: ThemeSource) => {
    setTheme(next)
    applyTheme(next)
    api.setThemeSource(next).catch(() => undefined)
  }

  const loadRepo = async (path: string) => {
    setLoading(true)
    setError('')
    try {
      const isRepo = await api.isGitRepository(path)
      if (!isRepo) {
        setRepo(null)
        setError(t('repo.notARepository'))
        return
      }
      const [branch, branches, status, commits] = await Promise.all([
        api.currentBranch(path),
        api.localBranches(path),
        api.statusEntries(path),
        api.recentCommits(path, 20),
      ])
      setRepo({ path, branch, branches, status, commits })
    } catch (e) {
      setError(t('errors.generic', { message: String(e) }))
    } finally {
      setLoading(false)
    }
  }

  const onOpen = async () => {
    const path = await api.pickDirectory()
    if (path) {
      await loadRepo(path)
    }
  }

  const onRefresh = () => {
    if (repo) {
      void loadRepo(repo.path)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="titles">
          <h1>{t('app.title')}</h1>
          <p className="tagline">{t('app.tagline')}</p>
        </div>
        <div className="controls">
          <label>
            {t('theme.label')}
            <select
              value={theme}
              onChange={e => onThemeChange(e.target.value as ThemeSource)}
            >
              <option value="system">{t('theme.system')}</option>
              <option value="light">{t('theme.light')}</option>
              <option value="dark">{t('theme.dark')}</option>
            </select>
          </label>
          <label>
            {t('about.language')}
            <select
              value={i18n.language}
              onChange={e => changeLanguage(e.target.value as LanguageCode)}
            >
              {supportedLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="toolbar">
        <button type="button" onClick={onOpen}>
          {t('toolbar.openRepository')}
        </button>
        <button type="button" onClick={onRefresh} disabled={!repo || loading}>
          {t('toolbar.refresh')}
        </button>
      </div>

      <main className="content">
        {loading && <p className="muted">{t('repo.loading')}</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && !repo && (
          <p className="muted empty">{t('repo.empty')}</p>
        )}

        {repo && !loading && (
          <section className="repo">
            <div className="repo-path">
              <span className="label">{t('repo.path')}</span>
              <code>{repo.path}</code>
              <button
                type="button"
                className="link"
                onClick={() =>
                  api.showItemInFolder(repo.path).catch(() => undefined)
                }
              >
                {t('repo.reveal')}
              </button>
            </div>

            <div className="repo-branch">
              <span className="label">{t('repo.branch')}</span>
              <strong>{repo.branch}</strong>
              {repo.branches.length > 0 && (
                <select
                  defaultValue={repo.branch}
                  aria-label={t('repo.branches')}
                >
                  {repo.branches.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="columns">
              <div className="panel">
                <h2>{t('repo.changes', { count: repo.status.length })}</h2>
                {repo.status.length === 0 ? (
                  <p className="muted">{t('repo.noChanges')}</p>
                ) : (
                  <ul className="status-list">
                    {repo.status.map(entry => (
                      <li key={entry.path}>
                        <span className="badge">{entry.status || '·'}</span>
                        <span className="path">{entry.path}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="panel">
                <h2>{t('repo.commits')}</h2>
                {repo.commits.length === 0 ? (
                  <p className="muted">{t('repo.noCommits')}</p>
                ) : (
                  <ul className="commit-list">
                    {repo.commits.map(commit => (
                      <li key={commit.sha}>
                        <code className="sha">{commit.shortSha}</code>
                        <span className="summary">{commit.summary}</span>
                        <span className="meta">
                          {commit.author} · {commit.date}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <span>{t('about.appVersion', { version: appVersion })}</span>
        <span>{gitVersion}</span>
        <span>{t('about.platform', { platform })}</span>
        <span>{t('about.architecture', { arch })}</span>
      </footer>
    </div>
  )
}

export default App
