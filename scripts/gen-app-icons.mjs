// Regenerate the Tauri app icon set from the bundled GitHub Desktop logo.
//
// Source of truth: apps/desktop/official/static/logos/prod/icon-logo.icns
// (the official prod app icon shipped with the upstream tree). We extract its
// largest embedded PNG frame and hand it to `tauri icon`, which emits every
// size/format under src-tauri/icons/.
//
//   node scripts/gen-app-icons.mjs
//
// Re-run whenever the source logo changes.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const appDir = join(here, '..', 'apps', 'desktop')
const icns = join(appDir, 'official', 'static', 'logos', 'prod', 'icon-logo.icns')

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** Parse an ICNS container and return its embedded PNG frames, largest first. */
function extractPngFrames(buf) {
  const frames = []
  // 8-byte file header: 'icns' + total length. Chunks follow: 4-byte type,
  // 4-byte big-endian length (incl. the 8-byte chunk header), then the data.
  let offset = 8
  while (offset + 8 <= buf.length) {
    const type = buf.toString('ascii', offset, offset + 4)
    const length = buf.readUInt32BE(offset + 4)
    if (length < 8 || offset + length > buf.length) break
    const data = buf.subarray(offset + 8, offset + length)
    if (data.subarray(0, 8).equals(PNG_SIG)) {
      // PNG IHDR width lives at bytes 16..20 of the PNG.
      const width = data.readUInt32BE(16)
      frames.push({ type, width, data })
    }
    offset += length
  }
  return frames.sort((a, b) => b.width - a.width)
}

const frames = extractPngFrames(readFileSync(icns))
if (frames.length === 0) {
  console.error('No PNG frames found in', icns)
  process.exit(1)
}

const best = frames[0]
console.log(
  `frames: ${frames.map(f => `${f.type}=${f.width}px`).join(', ')}`
)

const tmp = mkdtempSync(join(tmpdir(), 'ghd-icon-'))
const source = join(tmp, 'app-icon.png')
writeFileSync(source, best.data)
console.log(`source: ${source} (${best.width}px)`)

// `tauri icon <png>` writes the full set into src-tauri/icons/.
execFileSync(
  'pnpm',
  ['--filter', '@github-desktop-next/app', 'exec', 'tauri', 'icon', source],
  { cwd: join(here, '..'), stdio: 'inherit', shell: process.platform === 'win32' }
)
console.log('done')
