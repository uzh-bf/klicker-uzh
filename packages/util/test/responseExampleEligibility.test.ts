import { expect, it, vi } from 'vitest'
import {
  applyResponseExampleEligibilityReconciliation,
  buildResponseExampleEligibilityReconciliation,
  evaluateResponseExampleCurrentEligibility,
} from '../src/responseExampleEligibility.js'

const example = {
  referenceAnswer: 'Use the current course concept [1].',
  evidenceReferences: [
    {
      sourceId: 'source-1',
      contentHash: 'hash-1',
      citationIndex: 1,
    },
  ],
}

it('accepts complete citations backed by one current active resource', () => {
  expect(
    evaluateResponseExampleCurrentEligibility(example, [
      {
        id: 'source-1',
        activeContentSha256: 'hash-1',
        deletedAt: null,
      },
    ])
  ).toEqual({ eligible: true, evidenceEligibility: [true] })
})

it.each([
  ['missing resource', []],
  [
    'changed content hash',
    [{ id: 'source-1', activeContentSha256: 'hash-2', deletedAt: null }],
  ],
  [
    'inactive resource',
    [{ id: 'source-1', activeContentSha256: null, deletedAt: null }],
  ],
  [
    'deleted resource',
    [
      {
        id: 'source-1',
        activeContentSha256: 'hash-1',
        deletedAt: new Date(),
      },
    ],
  ],
])('rejects %s', (_name, resources) => {
  expect(evaluateResponseExampleCurrentEligibility(example, resources)).toEqual(
    { eligible: false, evidenceEligibility: [false] }
  )
})

it('rejects incomplete renderer-visible citation parity', () => {
  expect(
    evaluateResponseExampleCurrentEligibility(
      { ...example, referenceAnswer: 'No citation is rendered.' },
      [
        {
          id: 'source-1',
          activeContentSha256: 'hash-1',
          deletedAt: null,
        },
      ]
    )
  ).toEqual({ eligible: false, evidenceEligibility: [true] })
})

it('groups reconciliation writes by target eligibility', async () => {
  const reconciliation = buildResponseExampleEligibilityReconciliation(
    [
      {
        id: 'example-current',
        status: 'APPROVED',
        referenceAnswer: 'Current answer [1].',
        evidenceReferences: [
          {
            id: 'reference-current',
            sourceId: 'source-current',
            contentHash: 'hash-current',
            citationIndex: 1,
            evidenceEligible: false,
          },
        ],
      },
      {
        id: 'example-stale',
        status: 'APPROVED',
        referenceAnswer: 'Stale answer [1].',
        evidenceReferences: [
          {
            id: 'reference-stale',
            sourceId: 'source-stale',
            contentHash: 'hash-stale',
            citationIndex: 1,
            evidenceEligible: true,
          },
        ],
      },
    ],
    [
      {
        id: 'source-current',
        activeContentSha256: 'hash-current',
        deletedAt: null,
      },
    ]
  )
  const updateReferences = vi.fn(async () => ({ count: 1 }))
  const updateExamples = vi.fn(async () => ({ count: 1 }))

  await applyResponseExampleEligibilityReconciliation(
    {
      responseExampleEvidenceReference: { updateMany: updateReferences },
      responseExample: { updateMany: updateExamples },
    } as never,
    reconciliation
  )

  expect(reconciliation.changed).toBe(true)
  expect(updateReferences).toHaveBeenCalledTimes(2)
  expect(updateReferences).toHaveBeenNthCalledWith(1, {
    where: { id: { in: ['reference-current'] } },
    data: { evidenceEligible: true },
  })
  expect(updateReferences).toHaveBeenNthCalledWith(2, {
    where: { id: { in: ['reference-stale'] } },
    data: { evidenceEligible: false },
  })
  expect(updateExamples).toHaveBeenCalledWith({
    where: { id: { in: ['example-stale'] }, status: 'APPROVED' },
    data: {
      status: 'NEEDS_REVIEW',
      reviewedById: null,
      reviewedAt: null,
    },
  })
})
