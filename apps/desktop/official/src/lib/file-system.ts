import { Disposable } from 'event-kit'
import { Tailer } from './tailer'
import byline from 'byline'
import { createReadStream } from 'fs'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { tmpdir } from 'os'
import { invoke } from '@tauri-apps/api/core'

/**
 * Get a path to a temp file using the given name. Note that the file itself
 * will not be created.
 */
export const getTempFilePath = (name: string) =>
  join(tmpdir(), `${name}-${randomBytes(8).toString('hex')}`)

/**
 * Tail the file and call the callback on every line.
 *
 * Note that this will not stop tailing until the returned `Disposable` is
 * disposed of.
 */
export function tailByLine(
  path: string,
  cb: (line: string) => void
): Disposable {
  const tailer = new Tailer(path)

  const onErrorDisposable = tailer.onError(error => {
    log.warn(`Unable to tail path: ${path}`, error)
  })

  const onDataDisposable = tailer.onDataAvailable(stream => {
    byline(stream).on('data', (buffer: Buffer) => {
      if (onDataDisposable.disposed) {
        return
      }

      const line = buffer.toString()
      cb(line)
    })
  })

  tailer.start()

  return new Disposable(() => {
    onDataDisposable.dispose()
    onErrorDisposable.dispose()
    tailer.stop()
  })
}

/**
 * Read a specific region from a file.
 *
 * @param path  Path to the file
 * @param start First index relative to the start of the file to
 *              read from
 * @param end   Last index (inclusive) relative to the start of the
 *              file to read to
 */
export async function readPartialFile(
  path: string,
  start: number,
  end: number
): Promise<Buffer> {
  // The official implementation used Node's createReadStream to read a byte
  // range. In the Tauri build file access lives in Rust; read the whole file as
  // UTF-8 text via the fs_read_text_file command and slice the requested byte
  // range from the resulting Buffer. `end` is an inclusive index (Node
  // createReadStream semantics), so add 1 for the exclusive slice end. This is
  // only used by syntax highlighting, which caps the request at ~1MB and treats
  // the bytes as UTF-8 anyway, so reading the full text and slicing is
  // equivalent in practice.
  const contents = await invoke<string>('fs_read_text_file', { path })
  const buffer = Buffer.from(contents, 'utf8')
  return buffer.subarray(start, end + 1)
}
