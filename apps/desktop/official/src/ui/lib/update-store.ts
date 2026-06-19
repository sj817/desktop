const lastSuccessfulCheckKey = 'last-successful-update-check'

import { Emitter, Disposable } from 'event-kit'

import { ErrorWithMetadata } from '../../lib/error-with-metadata'

import { ReleaseSummary } from '../../models/release-notes'
import { generateReleaseSummary } from '../../lib/release-notes'
import { setNumber, getNumber } from '../../lib/local-storage'
import { gt, SemVer } from 'semver'
import { getVersion } from './app-proxy'
import { getUserAgent } from '../../lib/http'

/** The last version a showcase was seen. */
export const lastShowCaseVersionSeen = 'version-of-last-showcase'

/** The states the auto updater can be in. */
export enum UpdateStatus {
  /** The auto updater is checking for updates. */
  CheckingForUpdates,

  /** An update is available and will begin downloading. */
  UpdateAvailable,

  /** No update is available. */
  UpdateNotAvailable,

  /** An update has been downloaded and is ready to be installed. */
  UpdateReady,

  /** We have not checked for an update yet. */
  UpdateNotChecked,
}

export interface IUpdateState {
  status: UpdateStatus
  lastSuccessfulCheck: Date | null
  isX64ToARM64ImmediateAutoUpdate: boolean
  newReleases: ReadonlyArray<ReleaseSummary> | null
  prioritizeUpdate: boolean
  prioritizeUpdateInfoUrl: string | undefined
}

/** A store which contains the current state of the auto updater. */
class UpdateStore {
  private emitter = new Emitter()
  private status = UpdateStatus.UpdateNotChecked
  private lastSuccessfulCheck: Date | null = null
  private newReleases: ReadonlyArray<ReleaseSummary> | null = null
  private isX64ToARM64ImmediateAutoUpdate: boolean = false

  /** Is the most recent update check user initiated? */
  private userInitiatedUpdate = true
  private _prioritizeUpdate = false
  private _prioritizeUpdateInfoUrl: string | undefined = undefined

  public get prioritizeUpdate() {
    return this._prioritizeUpdate
  }

  public get prioritizeUpdateInfoUrl() {
    return this._prioritizeUpdateInfoUrl
  }

  private latestReleaseUrl: string | null = null

  public constructor() {
    const lastSuccessfulCheckTime = getNumber(lastSuccessfulCheckKey, 0)

    if (lastSuccessfulCheckTime > 0) {
      this.lastSuccessfulCheck = new Date(lastSuccessfulCheckTime)
    }
  }

  private touchLastChecked() {
    const now = new Date()
    this.lastSuccessfulCheck = now
    setNumber(lastSuccessfulCheckKey, now.getTime())
  }

  /** Register a function to call when the auto updater state changes. */
  public onDidChange(fn: (state: IUpdateState) => void): Disposable {
    return this.emitter.on('did-change', fn)
  }

  private emitDidChange() {
    this.emitter.emit('did-change', this.state)
  }

  /** Register a function to call when the auto updater encounters an error. */
  public onError(fn: (error: Error) => void): Disposable {
    return this.emitter.on('error', fn)
  }

  private emitError(error: Error) {
    const updatedError = new ErrorWithMetadata(error, {
      backgroundTask: !this.userInitiatedUpdate,
    })
    this.emitter.emit('error', updatedError)
  }

  /** The current auto updater state. */
  public get state(): IUpdateState {
    return {
      status: this.status,
      lastSuccessfulCheck: this.lastSuccessfulCheck,
      newReleases: this.newReleases,
      isX64ToARM64ImmediateAutoUpdate: this.isX64ToARM64ImmediateAutoUpdate,
      prioritizeUpdate: this.prioritizeUpdate,
      prioritizeUpdateInfoUrl: this.prioritizeUpdateInfoUrl,
    }
  }

  /**
   * Check for updates.
   *
   * @param inBackground  - Are we checking for updates in the background, or was
   *                       this check user-initiated?
   * @param skipGuidCheck - If true, don't check the GUID. If true, this will
   *                       effectively disable the staggered releases system and
   *                       attempt to retrieve the latest available deployment.
   */
  public async checkForUpdates(inBackground: boolean, _skipGuidCheck: boolean) {
    if (this.status === UpdateStatus.UpdateReady) {
      return
    }

    this.userInitiatedUpdate = !inBackground
    this.status = UpdateStatus.CheckingForUpdates
    this.emitDidChange()

    try {
      const response = await fetch(
        'https://api.github.com/repos/sj817/github-desktop-next/releases/latest',
        {
          headers: {
            'user-agent': getUserAgent(),
            Accept: 'application/vnd.github+json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const release: { tag_name: string; html_url: string } =
        await response.json()
      const latestVersion = release.tag_name.replace(/^v/, '')
      const currentVersion = getVersion()

      if (gt(new SemVer(latestVersion), new SemVer(currentVersion))) {
        this.latestReleaseUrl = release.html_url
        this.newReleases = await generateReleaseSummary()
        this.touchLastChecked()
        this.status = UpdateStatus.UpdateReady
        this.emitDidChange()
      } else {
        this.newReleases = await generateReleaseSummary()
        this.touchLastChecked()
        this.status = UpdateStatus.UpdateNotAvailable
        this.emitDidChange()
      }
    } catch (e) {
      this.status = UpdateStatus.UpdateNotAvailable
      this.emitError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  public quitAndInstallUpdate() {
    if (this.latestReleaseUrl) {
      window.open(this.latestReleaseUrl, '_blank')
    } else {
      window.open(
        'https://github.com/sj817/github-desktop-next/releases/latest',
        '_blank'
      )
    }
  }

  /**
   * Method to determine if we should show an update showcase call to action.
   *
   * @returns true if there is a pretext on the latest releases and that release
   * was published in the last 15 days.
   */
  public async isUpdateShowcase() {
    if (
      (__RELEASE_CHANNEL__ === 'development' ||
        __RELEASE_CHANNEL__ === 'test') &&
      this.newReleases === null &&
      this.status === UpdateStatus.UpdateNotChecked
    ) {
      // On prod or with test manual check for updates, we are doing this during
      // the automatic check for updates
      this.newReleases = await generateReleaseSummary()
    }

    if (this.newReleases === null) {
      return false
    }

    const lastShowCaseVersion = localStorage.getItem(lastShowCaseVersionSeen)
    if (lastShowCaseVersion !== null) {
      const lastShowCaseSemVersion = new SemVer(lastShowCaseVersion)
      const latestRelease = new SemVer(this.newReleases[0].latestVersion)
      if (gte(lastShowCaseSemVersion, latestRelease)) {
        return false
      }
    }

    return this.newReleases
      .filter(
        r => new Date(r.datePublished).getTime() > offsetFromNow(-15, 'days')
      )
      .some(r => r.pretext.length > 0)
  }

  /** This method has only been added for ease of testing the update banner in
   * this state and as such is limite to dev and test environments */
  public setIsx64ToARM64ImmediateAutoUpdate(value: boolean) {
    if (
      __RELEASE_CHANNEL__ !== 'development' &&
      __RELEASE_CHANNEL__ !== 'test'
    ) {
      return
    }

    this.isX64ToARM64ImmediateAutoUpdate = value
  }

  /** This method has only been added for ease of testing the update banner in
   * this state and as such is limite to dev and test environments */
  public setPrioritizeUpdate(value: boolean) {
    if (
      __RELEASE_CHANNEL__ !== 'development' &&
      __RELEASE_CHANNEL__ !== 'test'
    ) {
      return
    }

    this._prioritizeUpdate = value
  }

  /** This method has only been added for ease of testing the update banner in
   * this state and as such is limite to dev and test environments */
  public setPrioritizeUpdateInfoUrl(value: string | undefined) {
    if (
      __RELEASE_CHANNEL__ !== 'development' &&
      __RELEASE_CHANNEL__ !== 'test'
    ) {
      return
    }

    this._prioritizeUpdateInfoUrl = value
  }
}

/** The store which contains the current state of the auto updater. */
export const updateStore = new UpdateStore()
