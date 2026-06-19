// Stub for fs-admin (elevated filesystem ops). Moves to a Rust command.
const nope = (): never => {
  throw new Error('fs-admin is unavailable in the webview')
}

export const makeTree = nope
export const symlink = nope
export const unlink = nope

export default { makeTree, symlink, unlink }
