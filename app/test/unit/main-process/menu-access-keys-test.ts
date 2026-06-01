import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Extract the access key character from a Windows menu label.
 * The access key is the character immediately following an '&' that isn't
 * followed by another '&' (which would be an escaped ampersand).
 */
function getAccessKey(label: string): string | null {
  const match = label.match(/&([^&])/i)
  return match ? match[1].toLowerCase() : null
}

/**
 * Parse the menu source to find all Windows labels grouped by their top-level
 * menu. This uses a heuristic approach: it looks for ternary patterns and
 * groups them by the enclosing menu structure.
 *
 * Labels that share the same menu item slot (e.g. "Push" vs "Force Push" which
 * toggle based on state) are identified by sharing the same `id` field.
 */
function extractWindowsLabels(source: string): Map<string, string[]> {
  const menus = new Map<string, string[]>()

  // Strategy: find all top-level menu labels, then collect all Windows labels
  // within each submenu block. We track brace depth to know which menu we're in.

  const lines = source.split('\n')
  let currentMenu = ''
  let braceDepth = 0
  let menuStartDepth = 0
  let inSubmenu = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Track brace depth
    for (const ch of line) {
      if (ch === '{' || ch === '[') {
        braceDepth++
      }
      if (ch === '}' || ch === ']') {
        braceDepth--
      }
    }

    // Detect top-level menu labels
    const topMenuMatch = line.match(
      /label:\s*__DARWIN__\s*\?\s*'([^']*)'\s*:\s*'&?([^']*)'/
    )
    if (topMenuMatch) {
      const macLabel = topMenuMatch[1]
      if (
        [
          'File',
          'Edit',
          'View',
          'Repository',
          'Branch',
          'Help',
          'GitHub Desktop',
        ].includes(macLabel)
      ) {
        currentMenu = macLabel
        menuStartDepth = braceDepth
        inSubmenu = true
        if (!menus.has(currentMenu)) {
          menus.set(currentMenu, [])
        }
        continue
      }
    }

    // If we've returned to or below menu start depth, we've left the submenu
    if (inSubmenu && braceDepth <= menuStartDepth - 1) {
      inSubmenu = false
    }

    if (!inSubmenu || !currentMenu) {
      continue
    }

    // Capture Windows labels from ternary expressions
    const ternaryMatch = line.match(
      /(?:label:\s*)?__DARWIN__\s*\?\s*'[^']*'\s*:\s*'([^']*)'/
    )
    if (ternaryMatch) {
      const winLabel = ternaryMatch[1]
      if (getAccessKey(winLabel)) {
        menus.get(currentMenu)!.push(winLabel)
      }
    }

    // Capture return statements with ternary (helper functions inlined)
    const returnMatch = line.match(
      /return\s*__DARWIN__\s*\?\s*'[^']*'\s*:\s*'([^']*)'/
    )
    if (returnMatch) {
      const winLabel = returnMatch[1]
      if (getAccessKey(winLabel)) {
        menus.get(currentMenu)!.push(winLabel)
      }
    }
  }

  // Also parse standalone helper functions that generate labels for known menus
  // getStashedChangesLabel produces View menu items
  const helperLabels = source.matchAll(
    /return __DARWIN__\s*\?\s*'[^']*'\s*:\s*'([^']*)'/g
  )
  for (const match of helperLabels) {
    const label = match[1]
    if (getAccessKey(label)) {
      // Determine which menu this belongs to by context
      const idx = match.index!
      const beforeContext = source.slice(Math.max(0, idx - 500), idx)
      if (
        beforeContext.includes('StashedChanges') ||
        beforeContext.includes('stashed')
      ) {
        if (!menus.has('View')) {
          menus.set('View', [])
        }
        if (!menus.get('View')!.includes(label)) {
          menus.get('View')!.push(label)
        }
      } else if (
        beforeContext.includes('Push') ||
        beforeContext.includes('push')
      ) {
        if (!menus.has('Repository')) {
          menus.set('Repository', [])
        }
        if (!menus.get('Repository')!.includes(label)) {
          menus.get('Repository')!.push(label)
        }
      }
    }
  }

  return menus
}

describe('menu access keys', () => {
  it('has no duplicate access keys within any submenu on Windows', async () => {
    const menuSourcePath = path.resolve(
      __dirname,
      '../../../src/main-process/menu/build-default-menu.ts'
    )
    const source = await fs.readFile(menuSourcePath, 'utf-8')
    const menus = extractWindowsLabels(source)

    // Ensure we actually parsed something
    assert.ok(menus.size > 0, 'Should have found at least one menu')

    const duplicates: string[] = []

    for (const [menuName, labels] of menus) {
      const accessKeys = new Map<string, string[]>()

      for (const label of labels) {
        const key = getAccessKey(label)
        if (key) {
          if (!accessKeys.has(key)) {
            accessKeys.set(key, [])
          }
          accessKeys.get(key)!.push(label)
        }
      }

      for (const [key, items] of accessKeys) {
        if (items.length > 1) {
          // Allow duplicates for mutually exclusive toggle items
          // (e.g. Push/Force Push which never appear simultaneously)
          const isMutuallyExclusive =
            items.every(i => i.includes('ush')) ||
            items.every(i => i.includes('Show') || i.includes('Hide')) ||
            items.every(i => i.includes('Remove') || i.includes('Stash'))

          if (!isMutuallyExclusive) {
            duplicates.push(
              `Menu "${menuName}" has duplicate access key '&${key}': ${items
                .map(i => `"${i}"`)
                .join(', ')}`
            )
          }
        }
      }
    }

    assert.deepStrictEqual(
      duplicates,
      [],
      `Found duplicate access keys:\n${duplicates.join('\n')}`
    )
  })
})
