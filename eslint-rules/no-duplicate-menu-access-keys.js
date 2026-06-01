// @ts-check

/**
 * @typedef {import('eslint').Rule.RuleModule} RuleModule
 */

/**
 * Extract the access key character from a Windows menu label string.
 * The access key is the character immediately following a single '&'.
 *
 * @param {string} label
 * @returns {string | null}
 */
function getAccessKey(label) {
  const match = label.match(/&([^&])/)
  return match ? match[1].toLowerCase() : null
}

/** @type {RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow duplicate Windows menu access keys within the same submenu array',
      category: 'Possible Errors',
    },
    messages: {
      duplicateAccessKey:
        "Duplicate access key '&{{key}}' in menu. Already used by \"{{existingLabel}}\". Choose a different access key for \"{{currentLabel}}\".",
    },
  },
  create(context) {
    return {
      /**
       * Look for array expressions that contain objects with `label` properties
       * using '&' access key patterns (i.e., menu submenu arrays).
       */
      ArrayExpression(node) {
        // Only check arrays that contain object literals with label properties
        const menuItems = node.elements.filter(
          el =>
            el &&
            el.type === 'ObjectExpression' &&
            el.properties.some(
              p =>
                p.type === 'Property' &&
                p.key.type === 'Identifier' &&
                p.key.name === 'label'
            )
        )

        if (menuItems.length < 2) {
          return
        }

        /** @type {Map<string, {label: string, node: import('eslint').Rule.Node}>} */
        const seenKeys = new Map()

        for (const item of menuItems) {
          if (!item || item.type !== 'ObjectExpression') {
            continue
          }

          const labelProp = item.properties.find(
            p =>
              p.type === 'Property' &&
              p.key.type === 'Identifier' &&
              p.key.name === 'label'
          )

          if (!labelProp || labelProp.type !== 'Property') {
            continue
          }

          // Extract string labels - handle direct strings and ternary expressions
          const labelStrings = extractLabelStrings(labelProp.value)

          for (const labelStr of labelStrings) {
            const key = getAccessKey(labelStr)
            if (!key) {
              continue
            }

            const existing = seenKeys.get(key)
            if (existing) {
              context.report({
                node: labelProp.value,
                messageId: 'duplicateAccessKey',
                data: {
                  key,
                  existingLabel: existing.label,
                  currentLabel: labelStr,
                },
              })
            } else {
              seenKeys.set(key, { label: labelStr, node: labelProp.value })
            }
          }
        }
      },
    }
  },
}

/**
 * Extract string literal values from a label property value.
 * Handles: string literals, ternary expressions (picks the Windows label),
 * and template literals.
 *
 * @param {import('estree').Expression | import('estree').SpreadElement | import('estree').Pattern} node
 * @returns {string[]}
 */
function extractLabelStrings(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value.includes('&') ? [node.value] : []
  }

  // Handle: __DARWIN__ ? 'Mac Label' : 'Win&Label'
  if (node.type === 'ConditionalExpression') {
    // We want the Windows label (the alternate/falsy branch when test is __DARWIN__)
    const results = []
    // Check both branches since we don't always know which is Windows
    results.push(...extractLabelStrings(node.consequent))
    results.push(...extractLabelStrings(node.alternate))
    return results
  }

  return []
}
