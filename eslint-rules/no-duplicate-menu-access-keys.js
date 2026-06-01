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
      labelMustBeInline:
        'Menu item labels must be inline string literals or ternary expressions so access key conflicts can be statically detected.',
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

        /** @type {Map<string, {label: string, node: import('eslint').Rule.Node, itemIndex: number}>} */
        const seenKeys = new Map()

        for (let itemIndex = 0; itemIndex < menuItems.length; itemIndex++) {
          const item = menuItems[itemIndex]
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

          // Flag labels that aren't statically analyzable (variables, function calls)
          if (!isInlineLabel(labelProp.value)) {
            context.report({
              node: labelProp.value,
              messageId: 'labelMustBeInline',
            })
            continue
          }

          for (const labelStr of labelStrings) {
            const key = getAccessKey(labelStr)
            if (!key) {
              continue
            }

            const existing = seenKeys.get(key)
            if (existing && existing.itemIndex !== itemIndex) {
              context.report({
                node: labelProp.value,
                messageId: 'duplicateAccessKey',
                data: {
                  key,
                  existingLabel: existing.label,
                  currentLabel: labelStr,
                },
              })
            } else if (!existing) {
              seenKeys.set(key, {
                label: labelStr,
                node: labelProp.value,
                itemIndex,
              })
            }
          }
        }
      },
    }
  },
}

/**
 * Extract string literal values from a label property value.
 * Handles: string literals, template literals (including expressions),
 * and ternary expressions.
 *
 * @param {import('estree').Expression | import('estree').SpreadElement | import('estree').Pattern} node
 * @returns {string[]}
 */
function extractLabelStrings(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value.includes('&') ? [node.value] : []
  }

  // Handle template literals - reconstruct possible strings by combining
  // static quasis with extracted expression values
  if (node.type === 'TemplateLiteral') {
    return extractFromTemplateLiteral(node)
  }

  // Handle: __DARWIN__ ? 'Mac Label' : 'Win&Label'
  if (node.type === 'ConditionalExpression') {
    const results = []
    results.push(...extractLabelStrings(node.consequent))
    results.push(...extractLabelStrings(node.alternate))
    return results
  }

  return []
}

/**
 * Extract possible label strings from a template literal by recursing into
 * its expressions. Produces all combinations of expression branches.
 *
 * @param {import('estree').TemplateLiteral} node
 * @returns {string[]}
 */
function extractFromTemplateLiteral(node) {
  // Build all possible string combinations from the template
  // Start with the first quasi
  /** @type {string[]} */
  let combinations = [node.quasis[0].value.raw]

  for (let i = 0; i < node.expressions.length; i++) {
    const exprStrings = extractLeafStrings(node.expressions[i])
    const nextQuasi = node.quasis[i + 1].value.raw

    if (exprStrings.length === 0) {
      // Expression is opaque - use placeholder
      combinations = combinations.map(c => c + '*' + nextQuasi)
    } else {
      // Expand combinations with each possible expression value
      const expanded = []
      for (const combo of combinations) {
        for (const exprStr of exprStrings) {
          expanded.push(combo + exprStr + nextQuasi)
        }
      }
      combinations = expanded
    }
  }

  return combinations.filter(s => s.includes('&'))
}

/**
 * Extract all possible leaf string values from an expression.
 * Handles string literals and ternary expressions (recursively).
 *
 * @param {import('estree').Expression | import('estree').SpreadElement} node
 * @returns {string[]}
 */
function extractLeafStrings(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return [node.value]
  }

  if (node.type === 'ConditionalExpression') {
    return [
      ...extractLeafStrings(node.consequent),
      ...extractLeafStrings(node.alternate),
    ]
  }

  return []
}

/**
 * Check if a label value node is statically analyzable (inline).
 * Accepts string literals, template literals whose expressions are all
 * inline, and (potentially nested) ternary expressions whose leaves are
 * all string/template literals.
 *
 * @param {import('estree').Expression | import('estree').SpreadElement | import('estree').Pattern} node
 * @returns {boolean}
 */
function isInlineLabel(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return true
  }

  if (node.type === 'TemplateLiteral') {
    // If the access key (&X) is in the static parts of the template,
    // we can always extract it regardless of what expressions evaluate to
    const hasKeyInStatic = node.quasis.some(q => /&[^&]/.test(q.value.raw))
    if (hasKeyInStatic) {
      return true
    }
    // Otherwise, all expressions must be inline for us to find the key
    return node.expressions.every(expr => isInlineLabel(expr))
  }

  if (node.type === 'ConditionalExpression') {
    // Only require inlining for branches that could contain access keys.
    // A branch without any & character doesn't need validation.
    const consInline = !couldContainAccessKey(node.consequent) || isInlineLabel(node.consequent)
    const altInline = !couldContainAccessKey(node.alternate) || isInlineLabel(node.alternate)
    return consInline && altInline
  }

  return false
}

/**
 * Quick check whether a node could possibly contain an access key (&X).
 * Used to skip inline validation on branches that don't need it (e.g., macOS labels).
 *
 * @param {import('estree').Expression | import('estree').SpreadElement | import('estree').Pattern} node
 * @returns {boolean}
 */
function couldContainAccessKey(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return /&[^&]/.test(node.value)
  }

  if (node.type === 'TemplateLiteral') {
    return node.quasis.some(q => /&[^&]/.test(q.value.raw))
  }

  if (node.type === 'ConditionalExpression') {
    return couldContainAccessKey(node.consequent) || couldContainAccessKey(node.alternate)
  }

  // For variables, function calls, etc. — we can't tell, assume yes
  return true
}
