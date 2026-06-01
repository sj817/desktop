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
          // Ternary duplicates
          code: `const items = [
            { label: d ? 'Mac' : '&Worktrees', id: 'a' },
            { label: d ? 'Mac' : 'Sho&w stash', id: 'b' },
          ]`,
          errors: [{ messageId: 'duplicateAccessKey' }],
        },
      ],
    })
  })
})
