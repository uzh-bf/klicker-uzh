import { describe, expect, test } from 'vitest'
import { isManageProposalResult } from '../src/components/manage-proposal-card'

describe('Manage proposal card', () => {
  test('recognizes confirmation proposal envelopes', () => {
    expect(
      isManageProposalResult({
        kind: 'element.create',
        summary: 'Create a draft question',
        requiresConfirmation: true,
        payload: { type: 'SC' },
      })
    ).toBe(true)
  })

  test('rejects arbitrary tool output', () => {
    expect(isManageProposalResult({ ok: true })).toBe(false)
    expect(isManageProposalResult(null)).toBe(false)
  })
})
