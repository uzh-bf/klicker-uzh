import { describe, expect, test } from 'vitest'
import { parseCodeCardResult } from '@/src/lib/code-runner/cardResult'

describe('code card tool result', () => {
  test('parses a valid result and rejects malformed ones', () => {
    expect(
      parseCodeCardResult({
        kind: 'code-card',
        profile: 'r-base',
        starterCode: 'mean(1:3)',
      })
    ).toEqual({ profile: 'r-base', starterCode: 'mean(1:3)' })
    expect(parseCodeCardResult(null)).toBeNull()
    expect(
      parseCodeCardResult({
        kind: 'code-card',
        profile: 'bash',
        starterCode: '',
      })
    ).toBeNull()
    expect(
      parseCodeCardResult({ kind: 'code-card', profile: 'r-base' })
    ).toBeNull()
  })
})
