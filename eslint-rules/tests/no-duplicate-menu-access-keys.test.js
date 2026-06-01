const { describe, it } = require('node:test')
// @ts-check

const RuleTester = require('eslint').RuleTester
const rule = require('../no-duplicate-menu-access-keys')

const parserOptions = {
  ecmaVersion: 2015,
  sourceType: 'module',
}

describe('no-duplicate-menu-access-keys', () => {
  it('should report duplicate access keys in a menu array', () => {
    const ruleTester = new RuleTester({ parserOptions })
    ruleTester.run('no-duplicate-menu-access-keys', rule, {
      valid: [
        // Different access keys
        `const items = [
          { label: '&File', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        // No access keys at all
        `const items = [
          { label: 'File', id: 'a' },
          { label: 'Edit', id: 'b' },
        ]`,
        // Single item
        `const items = [{ label: '&File', id: 'a' }]`,
        // Different access keys in ternary
        `const items = [
          { label: d ? 'Mac' : '&File', id: 'a' },
          { label: d ? 'Mac' : '&Edit', id: 'b' },
        ]`,
        // Same access key in mutually exclusive branches of same item (allowed)
        `const items = [
          { label: d ? 'P&ush' : 'Force P&ush', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        // Escaped ampersands (&&) should not be treated as access keys
        `const items = [
          { label: 'Save && &Close', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        // Double ampersand without real access key shouldn't conflict
        `const items = [
          { label: 'Fish && Chips', id: 'a' },
          { label: '&Edit', id: 'b' },
        ]`,
        // Template literal with access key in static part and inline ternary expression
        {
          code: 'const items = [{ label: `O&pen in ${d ? "Terminal" : "shell"}`, id: "a" }, { label: `&File`, id: "b" }]',
          parserOptions: { ecmaVersion: 2015, sourceType: 'module' },
        },
        // Template literal with ternary expressions inside (compact pattern)
        {
          code: 'const items = [{ label: `${d ? "Remove" : "&Remove"}${ask ? "…" : ""}`, id: "a" }, { label: "&Edit", id: "b" }]',
          parserOptions: { ecmaVersion: 2015, sourceType: 'module' },
        },
      ],
      invalid: [
        {
          // Direct string duplicates
          code: `const items = [
            { label: '&Work', id: 'a' },
            { label: 'Sho&w', id: 'b' },
          ]`,
          errors: [{ messageId: 'duplicateAccessKey' }],
        },
        {
          // Ternary duplicates across different items
          code: `const items = [
            { label: d ? 'Mac' : '&Worktrees', id: 'a' },
            { label: d ? 'Mac' : 'Sho&w stash', id: 'b' },
          ]`,
          errors: [{ messageId: 'duplicateAccessKey' }],
        },
        {
          // Variable reference not allowed
          code: `const items = [
            { label: myVar, id: 'a' },
            { label: '&Edit', id: 'b' },
          ]`,
          errors: [{ messageId: 'labelMustBeInline' }],
        },
        {
          // Function call not allowed
          code: `const items = [
            { label: getLabel(), id: 'a' },
            { label: '&Edit', id: 'b' },
          ]`,
          errors: [{ messageId: 'labelMustBeInline' }],
        },
        {
          // Template literal with variable expression not allowed
          code: 'const items = [{ label: `${myLabel}`, id: "a" }, { label: "&Edit", id: "b" }]',
          parserOptions: { ecmaVersion: 2015, sourceType: 'module' },
          errors: [{ messageId: 'labelMustBeInline' }],
        },
        {
          // Template with ternary that conflicts with sibling
          code: 'const items = [{ label: `${d ? "Remove" : "&Remove"}${ask ? "…" : ""}`, id: "a" }, { label: "&Rename", id: "b" }]',
          parserOptions: { ecmaVersion: 2015, sourceType: 'module' },
          errors: [{ messageId: 'duplicateAccessKey' }],
        },
      ],
    })
  })
})
