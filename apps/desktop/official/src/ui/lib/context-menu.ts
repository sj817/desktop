import { t } from '@i18n'

const RestrictedFileExtensions = ['.cmd', '.exe', '.bat', '.sh']

export const CopyFilePathLabel = () =>
  t(__DARWIN__ ? 'Copy File Path' : 'Copy file path')

export const CopyRelativeFilePathLabel = () =>
  t(__DARWIN__ ? 'Copy Relative File Path' : 'Copy relative file path')

export const CopySelectedPathsLabel = () =>
  t(__DARWIN__ ? 'Copy Paths' : 'Copy paths')

export const CopySelectedRelativePathsLabel = () =>
  t(__DARWIN__ ? 'Copy Relative Paths' : 'Copy relative paths')

export const DefaultEditorLabel = () =>
  t(__DARWIN__ ? 'Open in External Editor' : 'Open in external editor')

export const DefaultShellLabel = () =>
  t(__DARWIN__ ? 'Open in Shell' : 'Open in shell')

export const RevealInFileManagerLabel = () =>
  t(
    __DARWIN__
      ? 'Reveal in Finder'
      : __WIN32__
      ? 'Show in Explorer'
      : 'Show in your File Manager'
  )

export const TrashNameLabel = () => t(__WIN32__ ? 'Recycle Bin' : 'Trash')

export const OpenWithDefaultProgramLabel = () =>
  t(__DARWIN__ ? 'Open with Default Program' : 'Open with default program')

export function isSafeFileExtension(extension: string): boolean {
  if (__WIN32__) {
    return RestrictedFileExtensions.indexOf(extension.toLowerCase()) === -1
  }
  return true
}
