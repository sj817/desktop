// @ts-check
/**
 * Adversarial test cases for no-duplicate-menu-access-keys
 * These test edge cases, potential bypasses, and boundary conditions
 */

const RuleTester = require('eslint').RuleTester
const rule = require('../no-duplicate-menu-access-keys')

const parserOptions = {
  ecmaVersion: 2015,
  sourceType: 'module',
}

const ruleTester = new RuleTester({ parserOptions })

console.log('\n=== ADVERSARIAL TESTS FOR no-duplicate-menu-access-keys ===\n')

// Test 1: Multiple access keys in one label (only first should be detected)
console.log('Test 1: Multiple access keys in one label')
try {
  ruleTester.run('multiple-keys-one-label', rule, {
    valid: [
      {
        code: `const items = [
          { label: '&File &Edit', id: 'a' },
          { label: '&View', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: Only first access key is detected\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 2: Escaped ampersands (&&)
console.log('Test 2: Escaped ampersands (&&)')
try {
  ruleTester.run('escaped-ampersands', rule, {
    valid: [
      {
        code: `const items = [
          { label: 'Save && Close', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
      },
      {
        code: `const items = [
          { label: '&&&File', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: Escaped ampersands handled correctly\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 3: Ampersand at end of string
console.log('Test 3: Ampersand at end of string')
try {
  ruleTester.run('ampersand-at-end', rule, {
    valid: [
      {
        code: `const items = [
          { label: 'File&', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: Trailing ampersand ignored\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 4: null/undefined in array
console.log('Test 4: null/undefined in array')
try {
  ruleTester.run('null-undefined', rule, {
    valid: [
      {
        code: `const items = [
          null,
          { label: '&File', id: 'a' },
          undefined,
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: null/undefined elements ignored\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 5: Deeply nested ternaries
console.log('Test 5: Deeply nested ternaries')
try {
  ruleTester.run('nested-ternaries', rule, {
    valid: [
      {
        code: `const items = [
          { label: a ? (b ? '&File' : '&Edit') : (c ? '&View' : '&Help'), id: 'x' },
          { label: '&Quit', id: 'y' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [
      {
        code: `const items = [
          { label: a ? (b ? '&File' : '&Edit') : (c ? '&View' : '&Help'), id: 'x' },
          { label: '&Find', id: 'y' },
        ]`,
        parserOptions,
        errors: [{ messageId: 'duplicateAccessKey' }],
      },
    ],
  })
  console.log('✓ PASS: Deeply nested ternaries analyzed correctly\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 6: Template literals with multiple expressions
console.log('Test 6: Template literals with multiple expressions')
try {
  ruleTester.run('template-multiple-expressions', rule, {
    valid: [
      {
        code: 'const items = [{ label: `${a ? "1" : "2"}_${b ? "x" : "y"}_&File`, id: "a" }, { label: "&Edit", id: "b" }]',
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: Multiple expressions in template handled\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 7: Case sensitivity
console.log('Test 7: Case sensitivity')
try {
  ruleTester.run('case-sensitivity', rule, {
    valid: [],
    invalid: [
      {
        code: `const items = [
          { label: '&File', id: 'a' },
          { label: '&file', id: 'b' },
        ]`,
        parserOptions,
        errors: [{ messageId: 'duplicateAccessKey' }],
      },
    ],
  })
  console.log('✓ PASS: Access keys are case-insensitive\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 8: Objects without label property
console.log('Test 8: Objects without label property')
try {
  ruleTester.run('no-label-property', rule, {
    valid: [
      {
        code: `const items = [
          { id: 'separator' },
          { label: '&File', id: 'a' },
          { type: 'separator' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: Objects without label ignored\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 9: Computed property keys
console.log('Test 9: Computed property keys (potential bypass)')
try {
  ruleTester.run('computed-properties', rule, {
    valid: [
      {
        // Should NOT detect duplicates with computed properties
        code: `const items = [
          { ['label']: '&File', id: 'a' },
          { ['label']: '&Find', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('⚠ BYPASS CONFIRMED: Computed properties not analyzed (expected limitation)\n')
} catch (e) {
  console.log('✗ Unexpected behavior:', e.message, '\n')
}

// Test 10: Binary expression (string concatenation)
console.log('Test 10: Binary expressions')
try {
  ruleTester.run('binary-expression', rule, {
    valid: [],
    invalid: [
      {
        code: `const items = [
          { label: 'P' + '&ush', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
        errors: [{ messageId: 'labelMustBeInline' }],
      },
    ],
  })
  console.log('✓ PASS: Binary expressions rejected\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 11: couldContainAccessKey edge case with variables
console.log('Test 11: Variables in macOS branches')
try {
  ruleTester.run('macos-variable-branch', rule, {
    valid: [],
    invalid: [
      {
        // This will be flagged even though macVariable might not contain &
        code: `const items = [
          { label: __DARWIN__ ? macVariable : '&Windows', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
        errors: [{ messageId: 'labelMustBeInline' }],
      },
    ],
  })
  console.log('⚠ FALSE POSITIVE RISK: Variables in "macOS" branches require inline (conservative behavior)\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 12: Empty strings
console.log('Test 12: Empty strings')
try {
  ruleTester.run('empty-strings', rule, {
    valid: [
      {
        code: `const items = [
          { label: '', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: Empty strings handled\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 13: Template with opaque expression creating placeholder
console.log('Test 13: Template with opaque variable')
try {
  ruleTester.run('template-opaque', rule, {
    valid: [],
    invalid: [
      {
        code: 'const items = [{ label: `${variable}&File`, id: "a" }, { label: "&Edit", id: "b" }]',
        parserOptions,
        errors: [{ messageId: 'labelMustBeInline' }],
      },
    ],
  })
  console.log('✓ PASS: Opaque expressions in templates rejected\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 14: Template with ternary containing access key in expression
console.log('Test 14: Template with access key in ternary expression')
try {
  ruleTester.run('template-ternary-key', rule, {
    valid: [],
    invalid: [
      {
        code: 'const items = [{ label: `${d ? "P&ush" : "Force P&ull"} changes`, id: "a" }, { label: "&Undo", id: "b" }]',
        parserOptions,
        errors: [{ messageId: 'duplicateAccessKey' }],
      },
    ],
  })
  console.log('✓ PASS: Access keys in template expressions detected\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 15: Same itemIndex logic - same item with different keys in branches
console.log('Test 15: Same item with different access keys across branches')
try {
  ruleTester.run('same-item-different-keys', rule, {
    valid: [
      {
        code: `const items = [
          { label: d ? 'P&ush' : 'Force P&ull', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: Same item different keys in branches allowed\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 16: Special characters as access keys
console.log('Test 16: Special characters as access keys')
try {
  ruleTester.run('special-chars', rule, {
    valid: [
      {
        code: `const items = [
          { label: '&[File]', id: 'a' },
          { label: '&{Edit}', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('✓ PASS: Special characters as access keys work\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

// Test 17: Spread elements (bypass detection)
console.log('Test 17: Spread elements in array')
try {
  ruleTester.run('spread-elements', rule, {
    valid: [
      {
        code: `const items = [
          ...otherItems,
          { label: '&File', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        parserOptions,
      },
    ],
    invalid: [],
  })
  console.log('⚠ LIMITATION: Spread elements skipped (cannot analyze statically)\n')
} catch (e) {
  console.log('✗ Unexpected:', e.message, '\n')
}

// Test 18: Logical expressions
console.log('Test 18: Logical expressions')
try {
  ruleTester.run('logical-expressions', rule, {
    valid: [],
    invalid: [
      {
        code: `const items = [
          { label: condition && '&File' || '&Edit', id: 'a' },
          { label: '&View', id: 'b' },
        ]`,
        parserOptions,
        errors: [{ messageId: 'labelMustBeInline' }],
      },
    ],
  })
  console.log('✓ PASS: Logical expressions rejected\n')
} catch (e) {
  console.log('✗ FAIL:', e.message, '\n')
}

console.log('=== ADVERSARIAL TESTS COMPLETE ===\n')
