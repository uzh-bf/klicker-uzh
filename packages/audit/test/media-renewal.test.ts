import { describe, expect, it } from 'vitest'
import {
  type ActiveAssessmentMediaReference,
  renewActiveAssessmentMediaPolicies,
} from '../src/index.js'

async function* references(): AsyncIterable<ActiveAssessmentMediaReference> {
  yield { blobName: `sha256/${'a'.repeat(64)}`, contentHash: 'a'.repeat(64) }
  yield { blobName: `sha256/${'b'.repeat(64)}`, contentHash: 'b'.repeat(64) }
}

describe('active assessment media policy renewal', () => {
  it('streams references and extends them to the calendar batch', async () => {
    const calls: string[] = []
    const summary = await renewActiveAssessmentMediaPolicies({
      references: references(),
      now: new Date('2026-08-12T00:00:00.000Z'),
      store: {
        async extendRetention(input) {
          calls.push(input.blobName)
          return {
            ...input,
            versionId: `version-${calls.length}`,
            outcome: calls.length === 1 ? 'EXTENDED' : 'ALREADY_SUFFICIENT',
          }
        },
      },
    })

    expect(calls).toEqual([
      `sha256/${'a'.repeat(64)}`,
      `sha256/${'b'.repeat(64)}`,
    ])
    expect(summary).toMatchObject({
      inspected: 2,
      extended: 1,
      alreadySufficient: 1,
      retainUntil: '2027-10-01T00:00:00.000Z',
    })
    expect(summary.minimumHorizonDays).toBeGreaterThan(30)
  })
})
