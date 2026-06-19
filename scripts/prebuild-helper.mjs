// Build the `git-credential-desktop` credential-helper binary and stage it where
// Tauri's externalBin expects it: src-tauri/binaries/git-credential-desktop-<triple>.
// Run automatically before `tauri build` / `tauri dev` (see tauri.conf.json).
//
// The target triple comes from TAURI_ENV_TARGET_TRIPLE when Tauri sets it (e.g.
// the CI matrix passing --target), otherwise the host triple.
import { execFileSync } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = join(here, '..', 'apps', 'desktop')
const helperCrate = join(appDir, 'git-credential-desktop')
const srcTauri = join(appDir, 'src-tauri')

function hostTriple() {
  const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' })
  const match = out.match(/^host:\s*(.+)$/m)
  if (!match) {
    throw new Error('could not determine host target triple from `rustc -vV`')
  }
  return match[1].trim()
}

const triple = process.env.TAURI_ENV_TARGET_TRIPLE || hostTriple()
const suffix = triple.includes('windows') ? '.exe' : ''
const exeName = `git-credential-desktop${suffix}`

console.log(`[prebuild-helper] building git-credential-desktop for ${triple}`)
execFileSync('cargo', ['build', '--release', '--target', triple], {
  cwd: helperCrate,
  stdio: 'inherit',
})

const built = join(helperCrate, 'target', triple, 'release', exeName)
const binDir = join(srcTauri, 'binaries')
mkdirSync(binDir, { recursive: true })
const dest = join(binDir, `git-credential-desktop-${triple}${suffix}`)
copyFileSync(built, dest)
console.log(`[prebuild-helper] staged ${dest}`)
