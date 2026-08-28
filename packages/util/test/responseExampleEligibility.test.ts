import { expect, it } from 'vitest'
import { evaluateResponseExampleCurrentEligibility } from '../src/responseExampleEligibility.js'

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
