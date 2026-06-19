// Generates a plain square PNG used as the source for `tauri icon`.
// Kept tiny and dependency-free so the scaffold can produce valid app icons
// without committing binary assets we cannot review. Run:
//   node scripts/gen-icon.mjs app-icon.png
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const size = 1024
// GitHub dark canvas colour.
const [r, g, b, a] = [36, 41, 47, 255]

const stride = size * 4 + 1
const raw = Buffer.alloc(stride * size)
let p = 0
for (let y = 0; y < size; y++) {
  raw[p++] = 0 // filter: none
  for (let x = 0; x < size; x++) {
    raw[p++] = r
    raw[p++] = g
    raw[p++] = b
    raw[p++] = a
  }
}

const table = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(size, 0)
ihdr.writeUInt32BE(size, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // colour type: RGBA
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])

const out = process.argv[2] || 'app-icon.png'
writeFileSync(out, png)
console.log(`wrote ${out} (${png.length} bytes, ${size}x${size})`)
