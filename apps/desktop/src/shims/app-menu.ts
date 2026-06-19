// Builds the application menu (File/Edit/View/Repository/Branch/Help) by reusing
// the official menu definition verbatim. Upstream's main process builds an
// Electron menu via buildDefaultMenu() and serializes it to an IMenu with
// menuFromElectronMenu() before sending it to the renderer over the 'app-menu'
// channel. We do the same here, against the electron shim's Menu.buildFromTemplate
// (see ./electron.ts), so the in-title-bar menu bar renders identically.
import { buildDefaultMenu } from '@official/main-process/menu/build-default-menu'
import { menuFromElectronMenu, IMenu } from '@official/models/app-menu'

export function buildAppMenu(): IMenu {
  return menuFromElectronMenu(
    buildElectronMenu() as Parameters<typeof menuFromElectronMenu>[0]
  )
}

// Builds the raw (electron-shim) menu, preserving each item's click handler so
// the electron shim can invoke a clicked item's handler directly (which emits
// the correct 'menu-event' name onto the local bus). Returned typed as unknown
// to avoid leaking the shim's FakeMenu type into the official IMenu contract.
export function buildElectronMenu(): unknown {
  return buildDefaultMenu({
    selectedExternalEditor: null,
    selectedShell: null,
    askForConfirmationOnForcePush: false,
    askForConfirmationOnRepositoryRemoval: true,
    hasCurrentPullRequest: false,
    isForcePushForCurrentRepository: false,
    isStashedChangesVisible: false,
    askForConfirmationWhenStashingAllChanges: true,
    isChangesFilterVisible: true,
  } as Parameters<typeof buildDefaultMenu>[0])
}
