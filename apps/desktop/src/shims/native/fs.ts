// Stub for 'fs' in the webview (used by official source and some deps). File
// access moves to Rust commands. Most calls throw clearly; pure existence checks
// return falsy so module load doesn't crash.
const nope = (): never => {
  throw new Error('fs is unavailable in the webview — use Rust file commands')
}

export const existsSync = () => false
export const readFileSync = nope
export const writeFileSync = nope
export const appendFileSync = nope
export const unlinkSync = nope
export const mkdirSync = nope
export const rmdirSync = nope
export const rmSync = nope
export const readdirSync = (): ReadonlyArray<string> => []
export const statSync = nope
export const lstatSync = nope
export const realpathSync = (p: string) => p
export const accessSync = nope

export const readFile = nope
export const writeFile = nope
export const appendFile = nope
export const unlink = nope
export const mkdir = nope
export const rmdir = nope
export const rm = nope
export const readdir = nope
export const stat = nope
export const lstat = nope
export const access = nope
export const readlink = nope
export const realpath = nope
export const open = nope
export const rename = nope
export const copyFile = nope
export const chmod = nope
export const watch = () => ({ close() {} })
export const watchFile = () => undefined
export const unwatchFile = () => undefined

export const createReadStream = nope
export const createWriteStream = nope
export class WriteStream {}
export class ReadStream {}
export const promises = {} as Record<string, unknown>
export const constants = {} as Record<string, number>

export default {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  unlinkSync,
  mkdirSync,
  rmdirSync,
  rmSync,
  readdirSync,
  statSync,
  lstatSync,
  realpathSync,
  accessSync,
  readFile,
  writeFile,
  appendFile,
  unlink,
  mkdir,
  rmdir,
  rm,
  readdir,
  stat,
  lstat,
  access,
  readlink,
  realpath,
  open,
  rename,
  copyFile,
  chmod,
  watch,
  watchFile,
  unwatchFile,
  createReadStream,
  createWriteStream,
  WriteStream,
  ReadStream,
  promises,
  constants,
}
