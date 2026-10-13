import assert from 'node:assert/strict'
import {
  designReviewConcentration,
  designReviewSlotEvidence,
} from '../src/components/elements/generation/designReviewSummary.ts'

// Slots without surfaced entities carry the empty list, so older worker
// artifacts render nothing extra.
assert.deepEqual(
  designReviewSlotEvidence([
    { sourceElementId: 'slot-1', moduleId: 'M1' },
    { sourceElementId: 'slot-2', moduleId: 'M1', evidenceEntityIds: [] },
    {
      sourceElementId: 'slot-3',
      moduleId: 'M1',
      evidenceEntityIds: ['entity-a', 'entity-b'],
    },
  ]),
  [
    { sourceElementId: 'slot-1', moduleId: 'M1', entityIds: [] },
    { sourceElementId: 'slot-2', moduleId: 'M1', entityIds: [] },
    {
      sourceElementId: 'slot-3',
      moduleId: 'M1',
      entityIds: ['entity-a', 'entity-b'],
    },
  ]
)

// A module whose slots all ground on one identical entity set is concentrated,
// regardless of the order the ids arrive in. A differing set, an empty set, and
// a lone slot are not.
const sharedEntityFixture = designReviewSlotEvidence([
  {
    sourceElementId: 'slot-1',
    moduleId: 'M1',
    evidenceEntityIds: ['entity-a', 'entity-b'],
  },
  {
    sourceElementId: 'slot-2',
    moduleId: 'M1',
    evidenceEntityIds: ['entity-b', 'entity-a'],
  },
  { sourceElementId: 'slot-3', moduleId: 'M1' },
])
assert.deepEqual(designReviewConcentration(sharedEntityFixture), [
  { moduleId: 'M1', entityIds: ['entity-a', 'entity-b'], slotCount: 2 },
])

assert.deepEqual(
  designReviewConcentration(
    designReviewSlotEvidence([
      {
        sourceElementId: 'slot-1',
        moduleId: 'M1',
        evidenceEntityIds: ['entity-a', 'entity-b'],
      },
      {
        sourceElementId: 'slot-2',
        moduleId: 'M1',
        evidenceEntityIds: ['entity-a'],
      },
    ])
  ),
  []
)

assert.deepEqual(
  designReviewConcentration(
    designReviewSlotEvidence([
      {
        sourceElementId: 'slot-1',
        moduleId: 'M1',
        evidenceEntityIds: ['entity-a'],
      },
    ])
  ),
  []
)

assert.deepEqual(
  designReviewConcentration(
    designReviewSlotEvidence([
      { sourceElementId: 'slot-1', moduleId: 'M1' },
      { sourceElementId: 'slot-2', moduleId: 'M1' },
    ])
  ),
  []
)

// Two modules are evaluated independently.
assert.deepEqual(
  designReviewConcentration(
    designReviewSlotEvidence([
      {
        sourceElementId: 'slot-1',
        moduleId: 'M1',
        evidenceEntityIds: ['entity-a'],
      },
      {
        sourceElementId: 'slot-2',
        moduleId: 'M1',
        evidenceEntityIds: ['entity-a'],
      },
      {
        sourceElementId: 'slot-3',
        moduleId: 'M2',
        evidenceEntityIds: ['entity-b'],
      },
      {
        sourceElementId: 'slot-4',
        moduleId: 'M2',
        evidenceEntityIds: ['entity-c'],
      },
    ])
  ),
  [{ moduleId: 'M1', entityIds: ['entity-a'], slotCount: 2 }]
)
