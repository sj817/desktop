import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  parseCopilotConflictResolution,
  isValidConfidence,
} from '../../src/lib/copilot-conflict-resolution'

describe('parseCopilotConflictResolution', () => {
  it('parses valid JSON with all required fields', () => {
    const input = JSON.stringify({
      resolutions: [
        {
          path: 'src/index.ts',
          resolvedContent: 'console.log("hello")',
          reasoning: 'Kept the newer implementation',
          confidence: 'high',
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
    assert.equal(result.resolutions[0].confidence, 'high')
  })

  it('strips ```json wrapper and parses', () => {
    const json = JSON.stringify({
      resolutions: [
        {
          path: 'README.md',
          resolvedContent: '# Hello',
          reasoning: 'Combined both headings',
          confidence: 'medium',
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
          confidence: 'low',
        },
      ],
    })
    const input = '```\n' + json + '\n```'

    const result = parseCopilotConflictResolution(input)
    assert.equal(result.resolutions[0].confidence, 'low')
  })

  it('parses multiple resolutions', () => {
    const input = JSON.stringify({
      resolutions: [
        {
          path: 'file1.ts',
          resolvedContent: 'content1',
          reasoning: 'reason1',
          confidence: 'high',
        },
        {
          path: 'file2.ts',
          resolvedContent: 'content2',
          reasoning: 'reason2',
          confidence: 'low',
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
                confidence: 'high',
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
                confidence: 'high',
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
                confidence: 'high',
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
                confidence: 'high',
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
                confidence: 'high',
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

  it('throws when confidence is invalid', () => {
    assert.throws(
      () =>
        parseCopilotConflictResolution(
          JSON.stringify({
            resolutions: [
              {
                path: 'file.ts',
                resolvedContent: 'content',
                reasoning: 'reason',
                confidence: 'very-high',
              },
            ],
          })
        ),
      {
        message:
          'Copilot returned an invalid conflict resolution payload: "confidence" at index 0 must be one of: high, medium, low',
      }
    )
  })

  it('accepts all valid confidence values', () => {
    for (const confidence of ['high', 'medium', 'low']) {
      const input = JSON.stringify({
        resolutions: [
          {
            path: 'file.ts',
            resolvedContent: 'content',
            reasoning: 'reason',
            confidence,
          },
        ],
      })

      const result = parseCopilotConflictResolution(input)
      assert.equal(result.resolutions[0].confidence, confidence)
    }
  })

  it('ignores extra fields (forward-compatible)', () => {
    const input = JSON.stringify({
      resolutions: [
        {
          path: 'file.ts',
          resolvedContent: 'content',
          reasoning: 'reason',
          confidence: 'high',
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
          confidence: 'high',
        },
      ],
    })

    const result = parseCopilotConflictResolution(input)
    assert.equal(result.resolutions[0].resolvedContent, '')
  })
})

describe('isValidConfidence', () => {
  it('returns true for high', () => {
    assert.equal(isValidConfidence('high'), true)
  })

  it('returns true for medium', () => {
    assert.equal(isValidConfidence('medium'), true)
  })

  it('returns true for low', () => {
    assert.equal(isValidConfidence('low'), true)
  })

  it('returns false for other strings', () => {
    assert.equal(isValidConfidence('very-high'), false)
    assert.equal(isValidConfidence(''), false)
    assert.equal(isValidConfidence('HIGH'), false)
    assert.equal(isValidConfidence('none'), false)
  })
})
