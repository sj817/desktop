import { encodePathAsUrl } from './path'
import { Emoji } from './emoji'

/**
 * Type representing the contents of the gemoji json database
 * which consists of a top-level array containing objects describing
 * emojis.
 */
type IGemojiDb = ReadonlyArray<IGemojiDefinition>

/**
 * Partial (there's more in the db) interface describing the elements
 * in the gemoji json array.
 */
interface IGemojiDefinition {
  /**
   * The unicode string of the emoji if emoji is part of
   * the unicode specification. If missing this emoji is
   * a GitHub custom emoji such as :shipit:
   */
  readonly emoji?: string

  /** One or more human readable aliases for the emoji character */
  readonly aliases: ReadonlyArray<string>

  /** An optional, human readable, description of the emoji  */
  readonly description?: string
}

function getEmojiImageUrlFromRelativePath(relativePath: string): string {
  // In the Tauri build the renderer is served over http and the gemoji images
  // are flattened into /static/emoji (see flattenOfficialStatic in
  // vite.config.ts). The original referenced __dirname ('/') + 'emoji'.
  return encodePathAsUrl('static', 'emoji', relativePath)
}

/**
 * Given a unicode point number, returns a hexadecimal string
 * which is lef padded with zeroes to be at least 4 characters
 */
function getHexCodePoint(cp: number): string {
  const str = cp.toString(16)

  // The combining characters are always stored on disk
  // as zero-padded 4 character strings. Don't ask me why.
  return str.length >= 4 ? str : ('0000' + str).substring(str.length)
}

/**
 * Returns a url to the on disk location of the image
 * representing the given emoji or null in case the
 * emoji unicode string was invalid.
 */
function getUrlFromUnicodeEmoji(emoji: string): string | null {
  const codePoint = emoji.codePointAt(0)

  if (!codePoint) {
    return null
  }

  let filename = getHexCodePoint(codePoint)

  // Some emoji are composed of two unicode code points, they're
  // usually variants of the same theme (like :one:, :two: etc)
  // and they're stored on disk as CP1-CP2.
  if (emoji.length > 2) {
    const combiningCodePoint = emoji.codePointAt(2)

    // 0xfe0f is VARIATION SELECTOR-16 which, best as I can tell means
    // make the character before me all fancy pants. I don't know why
    // but gemoji explicitly excludes this from its naming scheme so
    // we'll do the same.
    if (combiningCodePoint && combiningCodePoint !== 0xfe0f) {
      filename = `${filename}-${getHexCodePoint(combiningCodePoint)}`
    }
  }

  return getEmojiImageUrlFromRelativePath(`unicode/${filename}.png`)
}

/**
 * Read the stored emoji list from the bundled gemoji JSON into an in-memory
 * representation.
 *
 * The official implementation read emoji.json from disk with node's `fs`, which
 * throws in the WebView2 renderer (fs is aliased to a throwing stub). Here we
 * fetch it over http from the flattened static dir (/static/emoji.json). The
 * public contract is unchanged: a Map keyed by `:alias:` where every alias of an
 * emoji points at the same Emoji object, inserted in sorted order.
 *
 * @param _rootDir - Ignored. Kept for signature compatibility; the gemoji JSON
 *                   is fetched from /static instead of read from disk.
 */
export async function readEmoji(_rootDir: string): Promise<Map<string, Emoji>> {
  const jsonUrl = encodePathAsUrl('static', 'emoji.json')
  const response = await fetch(jsonUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to load emoji database (${response.status} ${response.statusText}) from ${jsonUrl}`
    )
  }

  const db: IGemojiDb = await response.json()
  const tmp = new Map<string, Emoji>()

  db.forEach(emoji => {
    // Custom emoji don't have a unicode string and are instead stored
    // on disk as their first alias.
    const url = emoji.emoji
      ? getUrlFromUnicodeEmoji(emoji.emoji)
      : getEmojiImageUrlFromRelativePath(`${emoji.aliases[0]}.png`)

    if (!url) {
      log.error(`Could not calculate location of emoji: ${emoji}`)
      return
    }

    emoji.aliases.forEach(alias => {
      tmp.set(`:${alias}:`, {
        ...emoji,
        url,
      })
    })
  })

  const emoji = new Map<string, Emoji>()

  // Sort and insert into actual map
  const keys = Array.from(tmp.keys()).sort()
  keys.forEach(k => {
    const value = tmp.get(k)
    if (value) {
      emoji.set(k, value)
    }
  })

  return emoji
}
