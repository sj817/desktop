import { app } from 'electron'
import * as Path from 'path'

let logDirectoryPath: string | null = null

export function getLogDirectoryPath() {
  if (!logDirectoryPath) {
    const userData = app.getPath('userData')
    logDirectoryPath = Path.join(userData, 'logs')
  }

  return logDirectoryPath
}
