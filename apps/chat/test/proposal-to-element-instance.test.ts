import { describe, expect, test } from 'vitest'
import type { ManageElementCreateProposal } from '../src/services/manageProposalSchema'
import { parseManageProposalPayload } from '../src/services/proposalToElementInstance'

const baseFields = {
  basePoints: true,
  pointsMultiplier: 1,
  status: 'DRAFT' as const,
  tags: [] as string[],
}

describe('parseManageProposalPayload', () => {
  test('returns the validated payload for a well-formed proposal envelope', () => {
    const payload = {
      ...baseFields,
      content: 'Explain the central limit theorem.',
      name: 'CLT explanation',
      options: {
        hasSampleSolution: false,
        restrictions: {},
      },
      type: 'FREE_TEXT',
    } satisfies ManageElementCreateProposal['payload']

    expect(
      parseManageProposalPayload({
        kind: 'element.create.proposal',
        payload,
        requiresConfirmation: true,
      })
    ).toEqual(payload)
  })

  test('returns null instead of throwing on a malformed proposal envelope', () => {
    expect(
      parseManageProposalPayload({
        kind: 'element.create.proposal',
        payload: { type: 'SC' },
        requiresConfirmation: true,
      })
    ).toBeNull()

    expect(parseManageProposalPayload({ not: 'a proposal' })).toBeNull()
    expect(parseManageProposalPayload(null)).toBeNull()
  })
})
