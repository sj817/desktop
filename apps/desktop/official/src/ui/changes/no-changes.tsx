import * as React from 'react'

import { encodePathAsUrl } from '../../lib/path'
import { Repository } from '../../models/repository'
import { LinkButton } from '../lib/link-button'
import { MenuIDs } from '../../models/menu-ids'
import { IMenu, MenuItem } from '../../models/app-menu'
import memoizeOne from 'memoize-one'
import { getPlatformSpecificNameOrSymbolForModifier } from '../../lib/menu-item'
import { MenuBackedSuggestedAction } from '../suggested-actions'
import { IRepositoryState } from '../../lib/app-state'
import { TipState, IValidBranch } from '../../models/tip'
import { Ref } from '../lib/ref'
import { IAheadBehind } from '../../models/branch'
import { IRemote } from '../../models/remote'
import {
  ForcePushBranchState,
  getCurrentBranchForcePushState,
} from '../../lib/rebase'
import { StashedChangesLoadStates } from '../../models/stash-entry'
import { Dispatcher } from '../dispatcher'
import { SuggestedActionGroup } from '../suggested-actions'
import { PreferencesTab } from '../../models/preferences'
import { PopupType } from '../../models/popup'
import {
  DropdownSuggestedAction,
  IDropdownSuggestedActionOption,
} from '../suggested-actions/dropdown-suggested-action'
import {
  PullRequestSuggestedNextAction,
  isIdPullRequestSuggestedNextAction,
} from '../../models/pull-request'
import { KeyboardShortcut } from '../keyboard-shortcut/keyboard-shortcut'
import { formatNumber } from '../../lib/format-number'
import { t } from '@i18n'
import { Trans } from 'react-i18next'

function formatMenuItemLabel(text: string) {
  if (__WIN32__ || __LINUX__) {
    // Ampersand has a special meaning on Windows where it denotes
    // the access key (usually rendered as an underline on the following)
    // character. A literal ampersand is escaped by putting another ampersand
    // in front of it (&&). Here we strip single ampersands and unescape
    // double ampersands. Example: "&Push && Pull" becomes "Push & Pull".
    return text.replace(/&?&/g, m => (m.length > 1 ? '&' : ''))
  }

  return text
}

function formatParentMenuLabel(menuItem: IMenuItemInfo) {
  const parentMenusText = menuItem.parentMenuLabels.join(' -> ')
  return formatMenuItemLabel(parentMenusText)
}

const PaperStackImage = encodePathAsUrl(__dirname, 'static/paper-stack.svg')

interface INoChangesProps {
  readonly dispatcher: Dispatcher

  /**
   * The currently selected repository
   */
  readonly repository: Repository

  /**
   * The top-level application menu item.
   */
  readonly appMenu: IMenu | undefined

  /**
   * An object describing the current state of
   * the selected repository. Used to determine
   * whether to render push, pull, publish, or
   * 'open pr' actions.
   */
  readonly repositoryState: IRepositoryState

  /**
   * Whether or not the user has a configured (explicitly,
   * or automatically) external editor. Used to
   * determine whether or not to render the action for
   * opening the repository in an external editor.
   */
  readonly isExternalEditorAvailable: boolean

  /** The user's preference of pull request suggested next action to use **/
  readonly pullRequestSuggestedNextAction?: PullRequestSuggestedNextAction
}

/**
 * Helper projection interface used to hold
 * computed information about a particular menu item.
 * Used internally in the NoChanges component to
 * trace whether a menu item is enabled, what its
 * keyboard shortcut is and so forth.
 */
interface IMenuItemInfo {
  /**
   * The textual representation of the menu item,
   * this is what's shown in the application menu
   */
  readonly label: string

  /**
   * Any accelerator keys (i.e. keyboard shortcut)
   * for the menu item. A menu item which can be
   * triggered using Command+Shift+K would be
   * represented here as three elements in the
   * array. Used to format and display the keyboard
   * shortcut for activating an action.
   */
  readonly acceleratorKeys: ReadonlyArray<string>

  /**
   * An ordered list of the labels for parent menus
   * of a particular menu item. Used to provide
   * a textual representation of where to locate
   * a particular action in the menu system.
   */
  readonly parentMenuLabels: ReadonlyArray<string>

  /**
   * Whether or not the menu item is currently
   * enabled.
   */
  readonly enabled: boolean
}

interface INoChangesState {
  /**
   * Whether or not to enable the slide in and
   * slide out transitions for the remote actions.
   *
   * Disabled initially and enabled 500ms after
   * component mounting in order to provide instant
   * loading of the remote action when the view is
   * initially appearing.
   */
  readonly enableTransitions: boolean
}

function getItemAcceleratorKeys(item: MenuItem) {
  if (item.type === 'separator' || item.type === 'submenuItem') {
    return []
  }

  if (item.accelerator === null) {
    return []
  }

  return item.accelerator
    .split('+')
    .map(getPlatformSpecificNameOrSymbolForModifier)
}

function buildMenuItemInfoMap(
  menu: IMenu,
  map = new Map<string, IMenuItemInfo>(),
  parent?: IMenuItemInfo
): ReadonlyMap<string, IMenuItemInfo> {
  for (const item of menu.items) {
    if (item.type === 'separator') {
      continue
    }

    const infoItem: IMenuItemInfo = {
      label: item.label as string,
      acceleratorKeys: getItemAcceleratorKeys(item),
      parentMenuLabels:
        parent === undefined ? [] : [parent.label, ...parent.parentMenuLabels],
      enabled: item.enabled,
    }

    map.set(item.id, infoItem)

    if (item.type === 'submenuItem') {
      buildMenuItemInfoMap(item.menu, map, infoItem)
    }
  }

  return map
}

/** The component to display when there are no local changes. */
export class NoChanges extends React.Component<
  INoChangesProps,
  INoChangesState
> {
  private getMenuInfoMap = memoizeOne((menu: IMenu | undefined) =>
    menu === undefined
      ? new Map<string, IMenuItemInfo>()
      : buildMenuItemInfoMap(menu)
  )

  /**
   * ID for the timer that's activated when the component
   * mounts. See componentDidMount/componentWillUnmount.
   */
  private transitionTimer: number | null = null

  public constructor(props: INoChangesProps) {
    super(props)
    this.state = {
      enableTransitions: false,
    }
  }

  private getMenuItemInfo(menuItemId: MenuIDs): IMenuItemInfo | undefined {
    return this.getMenuInfoMap(this.props.appMenu).get(menuItemId)
  }

  private getPlatformFileManagerName() {
    if (__DARWIN__) {
      return t('Finder')
    } else if (__WIN32__) {
      return t('Explorer')
    }
    return t('your File Manager')
  }

  private renderDiscoverabilityElements(menuItem: IMenuItemInfo) {
    const parentMenusText = formatParentMenuLabel(menuItem)

    return (
      <>
        {t('{{parentMenus}} menu or', { parentMenus: parentMenusText })}{' '}
        {this.renderDiscoverabilityKeyboardShortcut(menuItem)}
      </>
    )
  }

  private renderDiscoverabilityKeyboardShortcut(menuItemInfo: IMenuItemInfo) {
    return (
      <KeyboardShortcut
        darwinKeys={menuItemInfo.acceleratorKeys}
        keys={menuItemInfo.acceleratorKeys}
      />
    )
  }

  private renderMenuBackedAction(
    itemId: MenuIDs,
    title: string,
    description?: string | JSX.Element,
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  ) {
    const menuItem = this.getMenuItemInfo(itemId)

    if (menuItem === undefined) {
      log.error(`Could not find matching menu item for ${itemId}`)
      return null
    }

    return (
      <MenuBackedSuggestedAction
        title={title}
        description={description}
        discoverabilityContent={this.renderDiscoverabilityElements(menuItem)}
        menuItemId={itemId}
        buttonText={formatMenuItemLabel(menuItem.label)}
        disabled={!menuItem.enabled}
        onClick={onClick}
      />
    )
  }

  private renderShowInFileManager() {
    const fileManager = this.getPlatformFileManagerName()

    return this.renderMenuBackedAction(
      'open-working-directory',
      t('View the files of your repository in {{fileManager}}', { fileManager }),
      undefined,
      this.onShowInFileManagerClicked
    )
  }

  private onShowInFileManagerClicked = () =>
    this.props.dispatcher.incrementMetric('suggestedStepOpenWorkingDirectory')

  private renderViewOnGitHub() {
    const isGitHub = this.props.repository.gitHubRepository !== null

    if (!isGitHub) {
      return null
    }

    return this.renderMenuBackedAction(
      'view-repository-on-github',
      t('Open the repository page on GitHub in your browser'),
      undefined,
      this.onViewOnGitHubClicked
    )
  }

  private onViewOnGitHubClicked = () =>
    this.props.dispatcher.incrementMetric('suggestedStepViewOnGitHub')

  private openIntegrationPreferences = () => {
    this.props.dispatcher.showPopup({
      type: PopupType.Preferences,
      initialSelectedTab: PreferencesTab.Integrations,
    })
  }

  private renderOpenInExternalEditor() {
    if (!this.props.isExternalEditorAvailable) {
      return null
    }

    const itemId: MenuIDs = 'open-external-editor'
    const menuItem = this.getMenuItemInfo(itemId)

    if (menuItem === undefined) {
      log.error(`Could not find matching menu item for ${itemId}`)
      return null
    }

    const preferencesMenuItem = this.getMenuItemInfo('preferences')

    if (preferencesMenuItem === undefined) {
      log.error(`Could not find matching menu item for ${itemId}`)
      return null
    }

    const title = t('Open the repository in your external editor')

    const description = (
      <Trans i18nKey='no-changes.open-in-external-editor-description'>
        Select your editor in{' '}
        <LinkButton onClick={this.openIntegrationPreferences}>
          {t(__DARWIN__ ? 'Settings' : 'Options')}
        </LinkButton>
      </Trans>
    )

    return this.renderMenuBackedAction(
      itemId,
      title,
      description,
      this.onOpenInExternalEditorClicked
    )
  }

  private onOpenInExternalEditorClicked = () =>
    this.props.dispatcher.incrementMetric('suggestedStepOpenInExternalEditor')

  private renderRemoteAction() {
    const { remote, aheadBehind, branchesState, tagsToPush } =
      this.props.repositoryState
    const { tip, defaultBranch, currentPullRequest } = branchesState

    if (tip.kind !== TipState.Valid) {
      return null
    }

    if (remote === null) {
      return this.renderPublishRepositoryAction()
    }

    // Branch not published
    if (aheadBehind === null) {
      return this.renderPublishBranchAction(tip)
    }

    const isForcePush =
      getCurrentBranchForcePushState(branchesState, aheadBehind) ===
      ForcePushBranchState.Recommended
    if (isForcePush) {
      // do not render an action currently after the rebase has completed, as
      // the default behaviour is currently to pull in changes from the tracking
      // branch which will could potentially lead to a more confusing history
      return null
    }

    if (aheadBehind.behind > 0) {
      return this.renderPullBranchAction(tip, remote, aheadBehind)
    }

    if (
      aheadBehind.ahead > 0 ||
      (tagsToPush !== null && tagsToPush.length > 0)
    ) {
      return this.renderPushBranchAction(tip, remote, aheadBehind, tagsToPush)
    }

    const isGitHub = this.props.repository.gitHubRepository !== null
    const hasOpenPullRequest = currentPullRequest !== null
    const isDefaultBranch =
      defaultBranch !== null && tip.branch.name === defaultBranch.name

    if (isGitHub && !hasOpenPullRequest && !isDefaultBranch) {
      return this.renderCreatePullRequestAction(tip)
    }

    return null
  }

  private renderViewStashAction() {
    const { changesState, branchesState } = this.props.repositoryState

    const { tip } = branchesState
    if (tip.kind !== TipState.Valid) {
      return null
    }

    const { stashEntry } = changesState
    if (stashEntry === null) {
      return null
    }

    if (stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return null
    }

    const numChanges = stashEntry.files.files.length
    const description =
      numChanges === 1
        ? t('You have 1 change in progress that you have not yet committed.')
        : t('You have {{numChanges}} changes in progress that you have not yet committed.', { numChanges: formatNumber(numChanges) })
    const discoverabilityContent = (
      <>
        {t(
          'When a stash exists, access it at the bottom of the Changes tab to the left.'
        )}
      </>
    )
    const itemId: MenuIDs = 'toggle-stashed-changes'
    const menuItem = this.getMenuItemInfo(itemId)
    if (menuItem === undefined) {
      log.error(`Could not find matching menu item for ${itemId}`)
      return null
    }

    return (
      <MenuBackedSuggestedAction
        key="view-stash-action"
        title={t('View your stashed changes')}
        menuItemId={itemId}
        description={description}
        discoverabilityContent={discoverabilityContent}
        buttonText={t('View stash')}
        type="primary"
        disabled={menuItem !== null && !menuItem.enabled}
        onClick={this.onViewStashClicked}
      />
    )
  }

  private onViewStashClicked = () =>
    this.props.dispatcher.incrementMetric('suggestedStepViewStash')

  private renderPublishRepositoryAction() {
    // This is a bit confusing, there's no dedicated
    // publish menu item, the 'Push' menu item will initiate
    // a publish if the repository doesn't have a remote. We'll
    // use it here for the keyboard shortcut only.
    const itemId: MenuIDs = 'push'
    const menuItem = this.getMenuItemInfo(itemId)

    if (menuItem === undefined) {
      log.error(`Could not find matching menu item for ${itemId}`)
      return null
    }

    const discoverabilityContent = (
      <Trans i18nKey='no-changes.publish-repository-discoverability'>
        Always available in the toolbar for local repositories or{' '}
        {this.renderDiscoverabilityKeyboardShortcut(menuItem)}
      </Trans>
    )

    return (
      <MenuBackedSuggestedAction
        key="publish-repository-action"
        title={t('Publish your repository to GitHub')}
        description={t(
          'This repository is currently only available on your local machine. By publishing it on GitHub you can share it, and collaborate with others.'
        )}
        discoverabilityContent={discoverabilityContent}
        buttonText={t('Publish repository')}
        menuItemId={itemId}
        type="primary"
        disabled={!menuItem.enabled}
        onClick={this.onPublishRepositoryClicked}
      />
    )
  }

  private onPublishRepositoryClicked = () =>
    this.props.dispatcher.incrementMetric('suggestedStepPublishRepository')

  private renderPublishBranchAction(tip: IValidBranch) {
    // This is a bit confusing, there's no dedicated
    // publish branch menu item, the 'Push' menu item will initiate
    // a publish if the branch doesn't have a remote tracking branch.
    // We'll use it here for the keyboard shortcut only.
    const itemId: MenuIDs = 'push'
    const menuItem = this.getMenuItemInfo(itemId)

    if (menuItem === undefined) {
      log.error(`Could not find matching menu item for ${itemId}`)
      return null
    }

    const isGitHub = this.props.repository.gitHubRepository !== null

    const description = isGitHub ? (
      <Trans i18nKey='no-changes.publish-branch-github'>
        {"The current branch ("}
        <Ref>{{ branchName: tip.branch.name }}</Ref>
        {") hasn't been published to the remote yet. By publishing it to GitHub you can share it, open a pull request, and collaborate with others."}
      </Trans>
    ) : (
      <Trans i18nKey='no-changes.publish-branch-remote'>
        {"The current branch ("}
        <Ref>{{ branchName: tip.branch.name }}</Ref>
        {") hasn't been published to the remote yet. By publishing it you can share it and collaborate with others."}
      </Trans>
    )

    const discoverabilityContent = (
      <Trans i18nKey='no-changes.publish-branch-discoverability'>
        Always available in the toolbar or{' '}
        {this.renderDiscoverabilityKeyboardShortcut(menuItem)}
      </Trans>
    )

    return (
      <MenuBackedSuggestedAction
        key="publish-branch-action"
        title={t('Publish your branch')}
        menuItemId={itemId}
        description={description}
        discoverabilityContent={discoverabilityContent}
        buttonText={t('Publish branch')}
        type="primary"
        disabled={!menuItem.enabled}
        onClick={this.onPublishBranchClicked}
      />
    )
  }

  private onPublishBranchClicked = () =>
    this.props.dispatcher.incrementMetric('suggestedStepPublishBranch')

  private renderPullBranchAction(
    tip: IValidBranch,
    remote: IRemote,
    aheadBehind: IAheadBehind
  ) {
    const itemId: MenuIDs = 'pull'
    const menuItem = this.getMenuItemInfo(itemId)

    if (menuItem === undefined) {
      log.error(`Could not find matching menu item for ${itemId}`)
      return null
    }

    const isGitHub = this.props.repository.gitHubRepository !== null

    const description =
      aheadBehind.behind === 1 ? (
        isGitHub ? (
          <Trans i18nKey='no-changes.pull-branch-single-github'>
            {"The current branch ("}
            <Ref>{{ branchName: tip.branch.name }}</Ref>
            {") has a commit on GitHub that does not exist on your machine."}
          </Trans>
        ) : (
          <Trans i18nKey='no-changes.pull-branch-single-remote'>
            {"The current branch ("}
            <Ref>{{ branchName: tip.branch.name }}</Ref>
            {") has a commit on the remote that does not exist on your machine."}
          </Trans>
        )
      ) : isGitHub ? (
        <Trans i18nKey='no-changes.pull-branch-multiple-github'>
          {"The current branch ("}
          <Ref>{{ branchName: tip.branch.name }}</Ref>
          {") has commits on GitHub that do not exist on your machine."}
        </Trans>
      ) : (
        <Trans i18nKey='no-changes.pull-branch-multiple-remote'>
          {"The current branch ("}
          <Ref>{{ branchName: tip.branch.name }}</Ref>
          {") has commits on the remote that do not exist on your machine."}
        </Trans>
      )

    const discoverabilityContent = (
      <Trans i18nKey='no-changes.pull-branch-discoverability'>
        Always available in the toolbar when there are remote changes or{' '}
        {this.renderDiscoverabilityKeyboardShortcut(menuItem)}
      </Trans>
    )

    const title =
      aheadBehind.behind === 1
        ? t('Pull {{count}} commit from the {{remoteName}} remote', { count: formatNumber(aheadBehind.behind), remoteName: remote.name })
        : t('Pull {{count}} commits from the {{remoteName}} remote', { count: formatNumber(aheadBehind.behind), remoteName: remote.name })

    const buttonText = t('Pull {{remoteName}}', { remoteName: remote.name })

    return (
      <MenuBackedSuggestedAction
        key="pull-branch-action"
        title={title}
        menuItemId={itemId}
        description={description}
        discoverabilityContent={discoverabilityContent}
        buttonText={buttonText}
        type="primary"
        disabled={!menuItem.enabled}
      />
    )
  }

  private renderPushBranchAction(
    tip: IValidBranch,
    remote: IRemote,
    aheadBehind: IAheadBehind,
    tagsToPush: ReadonlyArray<string> | null
  ) {
    const itemId: MenuIDs = 'push'
    const menuItem = this.getMenuItemInfo(itemId)

    if (menuItem === undefined) {
      log.error(`Could not find matching menu item for ${itemId}`)
      return null
    }

    const isGitHub = this.props.repository.gitHubRepository !== null

    const itemsToPushTypes = []
    const itemsToPushDescriptions = []

    if (aheadBehind.ahead > 0) {
      itemsToPushTypes.push(t('commits'))
      itemsToPushDescriptions.push(
        aheadBehind.ahead === 1
          ? t('1 local commit')
          : t('{{count}} local commits', { count: formatNumber(aheadBehind.ahead) })
      )
    }

    if (tagsToPush !== null && tagsToPush.length > 0) {
      itemsToPushTypes.push(t('tags'))
      itemsToPushDescriptions.push(
        tagsToPush.length === 1
          ? t('1 tag')
          : t('{{count}} tags', { count: formatNumber(tagsToPush.length) })
      )
    }

    const description = t(
      'You have {{items}} waiting to be pushed to {{destination}}.',
      {
        items: itemsToPushDescriptions.join(t(' and ')),
        destination: isGitHub ? 'GitHub' : t('the remote'),
      }
    )

    const discoverabilityContent = (
      <Trans i18nKey='no-changes.push-branch-discoverability'>
        Always available in the toolbar when there are local commits waiting to
        be pushed or {this.renderDiscoverabilityKeyboardShortcut(menuItem)}
      </Trans>
    )

    const title = t('Push {{items}} to the {{remoteName}} remote', {
      items: itemsToPushTypes.join(t(' and ')),
      remoteName: remote.name,
    })

    const buttonText = t('Push {{remoteName}}', { remoteName: remote.name })

    return (
      <MenuBackedSuggestedAction
        key="push-branch-action"
        title={title}
        menuItemId={itemId}
        description={description}
        discoverabilityContent={discoverabilityContent}
        buttonText={buttonText}
        type="primary"
        disabled={!menuItem.enabled}
      />
    )
  }

  private onPullRequestSuggestedActionChanged = (action: string) => {
    if (isIdPullRequestSuggestedNextAction(action)) {
      this.props.dispatcher.setPullRequestSuggestedNextAction(action)
    }
  }

  private renderCreatePullRequestAction(tip: IValidBranch) {
    const createMenuItem = this.getMenuItemInfo('create-pull-request')
    if (createMenuItem === undefined) {
      log.error(`Could not find matching menu item for 'create-pull-request'`)
      return null
    }

    const description = (
      <Trans i18nKey='no-changes.create-pull-request-description'>
        {"The current branch ("}
        <Ref>{{ branchName: tip.branch.name }}</Ref>
        {") is already published to GitHub. Create a pull request to propose and collaborate on your changes."}
      </Trans>
    )

    const title = t('Create a Pull Request from your current branch')
    const buttonText = t('Create Pull Request')

    const previewPullMenuItem = this.getMenuItemInfo('preview-pull-request')

    if (previewPullMenuItem === undefined) {
      log.error(`Could not find matching menu item for 'preview-pull-request'`)
      return null
    }

    const createPullRequestAction: IDropdownSuggestedActionOption = {
      title,
      label: buttonText,
      description,
      id: PullRequestSuggestedNextAction.CreatePullRequest,
      menuItemId: 'create-pull-request',
      discoverabilityContent:
        this.renderDiscoverabilityElements(createMenuItem),
      disabled: !createMenuItem.enabled,
      onClick: this.onCreatePullRequestClicked,
    }

    const previewPullRequestAction: IDropdownSuggestedActionOption = {
      title: t('Preview the Pull Request from your current branch'),
      label: t('Preview Pull Request'),
      description: (
        <Trans i18nKey='no-changes.preview-pull-request-description'>
          {"The current branch ("}
          <Ref>{{ branchName: tip.branch.name }}</Ref>
          {") is already published to GitHub. Preview the changes this pull request will have before proposing your changes."}
        </Trans>
      ),
      id: PullRequestSuggestedNextAction.PreviewPullRequest,
      menuItemId: 'preview-pull-request',
      discoverabilityContent:
        this.renderDiscoverabilityElements(previewPullMenuItem),
      disabled: !previewPullMenuItem.enabled,
    }

    return (
      <DropdownSuggestedAction
        key="pull-request-action"
        className="pull-request-action"
        suggestedActions={[previewPullRequestAction, createPullRequestAction]}
        selectedActionValue={this.props.pullRequestSuggestedNextAction}
        onSuggestedActionChanged={this.onPullRequestSuggestedActionChanged}
      />
    )
  }

  private onCreatePullRequestClicked = () =>
    this.props.dispatcher.incrementMetric('suggestedStepCreatePullRequest')

  private renderActions() {
    return (
      <>
        <SuggestedActionGroup
          type="primary"
          transitions={'replace'}
          enableTransitions={this.state.enableTransitions}
        >
          {this.renderViewStashAction() || this.renderRemoteAction()}
        </SuggestedActionGroup>
        <SuggestedActionGroup>
          {this.renderOpenInExternalEditor()}
          {this.renderShowInFileManager()}
          {this.renderViewOnGitHub()}
        </SuggestedActionGroup>
      </>
    )
  }

  public componentDidMount() {
    this.transitionTimer = window.setTimeout(() => {
      this.setState({ enableTransitions: true })
      this.transitionTimer = null
    }, 500)
  }

  public componentWillUnmount() {
    if (this.transitionTimer !== null) {
      clearTimeout(this.transitionTimer)
    }
  }

  public render() {
    return (
      <div className="changes-interstitial">
        <div className="content">
          <div className="interstitial-header">
            <div className="text">
              <h1>{t('No local changes')}</h1>
              <p>
                {t(
                  'There are no uncommitted changes in this repository. Here are some friendly suggestions for what to do next.'
                )}
              </p>
            </div>
            <img src={PaperStackImage} className="blankslate-image" alt="" />
          </div>
          {this.renderActions()}
        </div>
      </div>
    )
  }
}
