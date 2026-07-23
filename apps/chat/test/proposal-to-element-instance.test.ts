import type {
  ChoicesElementData,
  FreeTextElementData,
} from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, test } from 'vitest'
import type { ManageElementCreateProposal } from '../src/services/manageProposalSchema'
import {
  parseManageProposalPayload,
  proposalPayloadToElementInstance,
} from '../src/services/proposalToElementInstance'

describe('proposalPayloadToElementInstance', () => {
  test('backfills missing choice ix values for SC payloads', () => {
    const payload = {
      basePoints: true,
      content: 'What does standard deviation measure?',
      name: 'Standard deviation interpretation',
      options: {
        choices: [
          { correct: true, value: 'Variation or dispersion in the data' },
          { correct: false, value: 'The average value' },
        ],
        displayMode: 'LIST',
        hasAnswerFeedbacks: false,
        hasSampleSolution: true,
      },
      pointsMultiplier: 1,
      status: 'DRAFT',
      tags: [],
      type: 'SC',
    } satisfies ManageElementCreateProposal['payload']

    const instance = proposalPayloadToElementInstance(payload)
    const elementData = instance.elementData as ChoicesElementData

    expect(instance.id).toBe(0)
    expect(instance.type).toBe('LIVE_QUIZ')
    expect(instance.elementType).toBe('SC')
    expect(elementData.__typename).toBe('ChoicesElementData')
    expect(elementData.options.choices).toEqual([
      expect.objectContaining({
        ix: 0,
        value: 'Variation or dispersion in the data',
      }),
      expect.objectContaining({ ix: 1, value: 'The average value' }),
    ])
  })

  test('preserves explicit choice ix values for MC payloads', () => {
    const payload = {
      basePoints: true,
      content: 'Which of the following are prime numbers?',
      name: 'Prime numbers',
      options: {
        choices: [
          { correct: true, ix: 5, value: '2' },
          { correct: true, ix: 2, value: '3' },
        ],
        displayMode: 'LIST',
        hasAnswerFeedbacks: false,
        hasSampleSolution: true,
      },
      pointsMultiplier: 1,
      status: 'DRAFT',
      tags: [],
      type: 'MC',
    } satisfies ManageElementCreateProposal['payload']

    const instance = proposalPayloadToElementInstance(payload)
    const elementData = instance.elementData as ChoicesElementData

    expect(elementData.options.choices).toEqual([
      expect.objectContaining({ ix: 5, value: '2' }),
      expect.objectContaining({ ix: 2, value: '3' }),
    ])
  })

  test('maps FREE_TEXT payloads with minimal options', () => {
    const payload = {
      basePoints: true,
      content: 'Explain the central limit theorem.',
      name: 'CLT explanation',
      options: {
        hasSampleSolution: false,
        restrictions: {},
      },
      pointsMultiplier: 1,
      status: 'DRAFT',
      tags: [],
      type: 'FREE_TEXT',
    } satisfies ManageElementCreateProposal['payload']

    const instance = proposalPayloadToElementInstance(payload)
    const elementData = instance.elementData as FreeTextElementData

    expect(elementData.__typename).toBe('FreeTextElementData')
    expect(elementData.options).toEqual({
      hasSampleSolution: false,
      restrictions: {},
    })
  })
})

describe('parseManageProposalPayload', () => {
  test('returns the validated payload for a well-formed proposal envelope', () => {
    const payload = {
      basePoints: true,
      content: 'Explain the central limit theorem.',
      name: 'CLT explanation',
      options: {
        hasSampleSolution: false,
        restrictions: {},
      },
      pointsMultiplier: 1,
      status: 'DRAFT',
      tags: [],
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
