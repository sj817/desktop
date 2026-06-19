import { shell } from '../../lib/app-shell'
import { Dispatcher } from '../dispatcher'
import { t } from '@i18n'

export async function openFile(
  fullPath: string,
  dispatcher: Dispatcher
): Promise<void> {
  const result = await shell.openExternal(`file://${fullPath}`)

  if (!result) {
    const error = {
      name: 'no-external-program',
      message: t('Unable to open file {{fullPath}} in an external program. Please check you have a program associated with this file extension', { fullPath }),
    }
    await dispatcher.postError(error)
  }
}
