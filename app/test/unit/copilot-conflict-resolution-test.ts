import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseCopilotConflictResolution } from '../../src/lib/copilot-conflict-resolution'

describe('parseCopilotConflictResolution', () => {
  it('parses valid JSON with all required fields', () => {
    const input = JSON.stringify({
      resolutions: [
        {
          path: 'src/index.ts',
          resolvedContent: 'console.log("hello")',
          reasoning: 'Kept the newer implementation',
        },
      ],
    })

    const result = parseCopilotConflictResolution(input)

    assert.equal(result.resolutions.length, 1)
    assert.equal(result.resolutions[0].path, 'src/index.ts')
    assert.equal(result.resolutions[0].resolvedContent, 'console.log("hello")')
    assert.equal(
      result.resolutions[0].reasoning,
      'Kept the newer implementation'
    )
  })

  it('strips ```json wrapper and parses', () => {
    const json = JSON.stringify({
      resolutions: [
        {
          path: 'README.md',
          resolvedContent: '# Hello',
          reasoning: 'Combined both headings',
        },
      ],
    })
    const input = '```json\n' + json + '\n```'

    const result = parseCopilotConflictResolution(input)
    assert.equal(result.resolutions.length, 1)
    assert.equal(result.resolutions[0].path, 'README.md')
  })

  it('strips bare ``` wrapper and parses', () => {
    const json = JSON.stringify({
      resolutions: [
        {
          path: 'a.txt',
          resolvedContent: 'content',
          reasoning: 'reason',
        },
      ],
    })
    const input = '```\n' + json + '\n```'

    const result = parseCopilotConflictResolution(input)
    assert.equal(result.resolutions[0].path, 'a.txt')
  })

  it('parses multiple resolutions', () => {
    const input = JSON.stringify({
      resolutions: [
        {
          path: 'file1.ts',
          resolvedContent: 'content1',
          reasoning: 'reason1',
        },
        {
          path: 'file2.ts',
          resolvedContent: 'content2',
          reasoning: 'reason2',
        },
      ],
    })

    const result = parseCopilotConflictResolution(input)
    assert.equal(result.resolutions.length, 2)
    assert.equal(result.resolutions[0].path, 'file1.ts')
    assert.equal(result.resolutions[1].path, 'file2.ts')
  })

  it('throws on invalid JSON', () => {
    assert.throws(() => parseCopilotConflictResolution('not json at all'), {
      message:
        'Copilot returned invalid JSON for conflict resolution generation',
    })
  })

  it('throws when top-level value is not an object', () => {
    assert.throws(() => parseCopilotConflictResolution('"just a string"'), {
      message:
        'Copilot returned an invalid conflict resolution payload: expected an object',
    })
  })

  it('throws when resolutions field is missing', () => {
    assert.throws(
      () => parseCopilotConflictResolution(JSON.stringify({ other: 1 })),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "resolutions" must be an array',
      }
    )
  })

  it('throws when resolutions is not an array', () => {
    assert.throws(
      () =>
        parseCopilotConflictResolution(
          JSON.stringify({ resolutions: 'not-array' })
        ),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "resolutions" must be an array',
      }
    )
  })

  it('throws when resolutions array is empty', () => {
    assert.throws(
      () => parseCopilotConflictResolution(JSON.stringify({ resolutions: [] })),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "resolutions" must not be empty',
      }
    )
  })

  it('throws when path is missing', () => {
    assert.throws(
      () =>
        parseCopilotConflictResolution(
          JSON.stringify({
            resolutions: [
              {
                resolvedContent: 'content',
                reasoning: 'reason',
              },
            ],
          })
        ),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "path" at index 0 must be a non-empty string',
      }
    )
  })

  it('throws when path is empty', () => {
    assert.throws(
      () =>
        parseCopilotConflictResolution(
          JSON.stringify({
            resolutions: [
              {
                path: '  ',
                resolvedContent: 'content',
                reasoning: 'reason',
              },
            ],
          })
        ),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "path" at index 0 must be a non-empty string',
      }
    )
  })

  it('throws when resolvedContent is missing', () => {
    assert.throws(
      () =>
        parseCopilotConflictResolution(
          JSON.stringify({
            resolutions: [
              {
                path: 'file.ts',
                reasoning: 'reason',
              },
            ],
          })
        ),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "resolvedContent" at index 0 must be a string',
      }
    )
  })

  it('throws when reasoning is missing', () => {
    assert.throws(
      () =>
        parseCopilotConflictResolution(
          JSON.stringify({
            resolutions: [
              {
                path: 'file.ts',
                resolvedContent: 'content',
              },
            ],
          })
        ),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "reasoning" at index 0 must be a non-empty string',
      }
    )
  })

  it('throws when reasoning is empty', () => {
    assert.throws(
      () =>
        parseCopilotConflictResolution(
          JSON.stringify({
            resolutions: [
              {
                path: 'file.ts',
                resolvedContent: 'content',
                reasoning: '',
              },
            ],
          })
        ),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "reasoning" at index 0 must be a non-empty string',
      }
    )
  })

  it('ignores extra fields (forward-compatible)', () => {
    const input = JSON.stringify({
      resolutions: [
        {
          path: 'file.ts',
          resolvedContent: 'content',
          reasoning: 'reason',
          extraField: 'should be ignored',
        },
      ],
      version: '2.0',
    })

    const result = parseCopilotConflictResolution(input)
    assert.equal(result.resolutions.length, 1)
    assert.equal(result.resolutions[0].path, 'file.ts')
    // Extra fields should not appear on the result
    assert.equal(
      'extraField' in result.resolutions[0],
      false,
      'extra fields should not be present on the result'
    )
  })

  it('allows empty string for resolvedContent', () => {
    const input = JSON.stringify({
      resolutions: [
        {
          path: 'file.ts',
          resolvedContent: '',
          reasoning: 'File should be empty after resolution',
        },
      ],
    })

    const result = parseCopilotConflictResolution(input)
    assert.equal(result.resolutions[0].resolvedContent, '')
  })
})
