import { MenuItemConstructorOptions } from 'electron'
import { enableTestMenuItems } from '../../lib/feature-flag'
import { emit, separator } from './build-default-menu'
import { t } from '@i18n'

export function buildTestMenu() {
  if (!enableTestMenuItems()) {
    return []
  }

  const testMenuItems: MenuItemConstructorOptions[] = []

  if (__WIN32__) {
    testMenuItems.push(separator, {
      label: t('Command Line Tool'),
      submenu: [
        {
          label: t('Install'),
          click: emit('install-windows-cli'),
        },
        {
          label: t('Uninstall'),
          click: emit('uninstall-windows-cli'),
        },
      ],
    })
  }

  const errorDialogsSubmenu: MenuItemConstructorOptions[] = [
    {
      label: t('Confirm Committing Conflicted Files'),
      click: emit('test-confirm-committing-conflicted-files'),
    },
    {
      label: t('Discarded Changes Will Be Unrecoverable'),
      click: emit('test-discarded-changes-will-be-unrecoverable'),
    },
    {
      label: t('Do you want to fork this repository?'),
      click: emit('test-do-you-want-fork-this-repository'),
    },
    {
      label: t('Newer Commits On Remote'),
      click: emit('test-newer-commits-on-remote'),
    },
    {
      label: t('Files Too Large'),
      click: emit('test-files-too-large'),
    },
    {
      label: t('Generic Git Authentication'),
      click: emit('test-generic-git-authentication'),
    },
    {
      label: t('Invalidated Account Token'),
      click: emit('test-invalidated-account-token'),
    },
  ]

  if (__DARWIN__) {
    errorDialogsSubmenu.push({
      label: t('Move to Application Folder'),
      click: emit('test-move-to-application-folder'),
    })
  }

  errorDialogsSubmenu.push(
    {
      label: t('Push Rejected'),
      click: emit('test-push-rejected'),
    },
    {
      label: t('Re-Authorization Required'),
      click: emit('test-re-authorization-required'),
    },
    {
      label: t('Unable to Locate Git'),
      click: emit('test-unable-to-locate-git'),
    },
    {
      label: t('Unable to Open External Editor'),
      click: emit('test-no-external-editor'),
    },
    {
      label: t('Unable to Open Shell'),
      click: emit('test-unable-to-open-shell'),
    },
    {
      label: t('Untrusted Server'),
      click: emit('test-untrusted-server'),
    },
    {
      label: t('Update Existing Git LFS Filters?'),
      click: emit('test-update-existing-git-lfs-filters'),
    },
    {
      label: t('Upstream Already Exists'),
      click: emit('test-upstream-already-exists'),
    }
  )

  testMenuItems.push(
    separator,
    {
      label: t('Crash main process…'),
      click() {
        throw new Error('Boomtown!')
      },
    },
    {
      label: t('Crash renderer process…'),
      click: emit('boomtown'),
    },
    {
      label: t('Prune branches'),
      click: emit('test-prune-branches'),
    },
    {
      label: t('Show notification'),
      click: emit('test-notification'),
    },
    {
      label: t('Show popup'),
      submenu: [
        {
          label: t('Release notes'),
          click: emit('test-release-notes-popup'),
        },
        {
          label: t('Thank you'),
          click: emit('test-thank-you-popup'),
        },
        {
          label: t('Show App Error'),
          click: emit('test-app-error'),
        },
        {
          label: t('Octicons'),
          click: emit('test-icons'),
        },
        {
          label: t('About dialog (test mode)'),
          click: emit('test-about-dialog'),
        },
      ],
    },
    {
      label: t('Show banner'),
      submenu: [
        {
          label: t('Update banner'),
          click: emit('test-update-banner'),
        },
        {
          label: t('Update banner (priority)'),
          click: emit('test-prioritized-update-banner'),
        },
        {
          label: t('Showcase Update banner'),
          click: emit('test-showcase-update-banner'),
        },
        {
          label: t('{{arch}} banner', {
            arch: __DARWIN__ ? 'Apple silicon' : 'Arm64',
          }),
          click: emit('test-arm64-banner'),
        },
        {
          label: t('Thank you'),
          click: emit('test-thank-you-banner'),
        },
        {
          label: t('Reorder Successful'),
          click: emit('test-reorder-banner'),
        },
        {
          label: t('Reorder Undone'),
          click: emit('test-undone-banner'),
        },
        {
          label: t('Cherry Pick Conflicts'),
          click: emit('test-cherry-pick-conflicts-banner'),
        },
        {
          label: t('Merge Successful'),
          click: emit('test-merge-successful-banner'),
        },
        {
          label: t('OS Version No Longer Supported'),
          click: emit('test-os-version-no-longer-supported'),
        },
      ],
    },
    {
      label: t('Show Error Dialogs'),
      submenu: errorDialogsSubmenu,
    }
  )

  return testMenuItems
}
