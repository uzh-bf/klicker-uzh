import assert from 'node:assert/strict'
import { designReviewObjectives } from '../src/components/elements/generation/designReviewSummary.ts'

// Only an explicit 'neutral' objectiveSource is a generated default. A build
// persisted before the marker, and an explicit 'provided' objective, both stay
// lecturer guidance.
assert.deepEqual(
  designReviewObjectives([
    { id: 'OBJ-01', text: 'Explain X.', bloomLevel: 'understand' },
    {
      id: 'OBJ-02',
      text: 'Explain Y.',
      bloomLevel: 'understand',
      objectiveSource: 'provided',
    },
    {
      id: 'OBJ-03',
      text: 'Assess Z.',
      bloomLevel: 'evaluate',
      objectiveSource: 'neutral',
    },
  ]),
  [
    {
      id: 'OBJ-01',
      text: 'Explain X.',
      bloomLevel: 'understand',
      isGeneratedDefault: false,
    },
    {
      id: 'OBJ-02',
      text: 'Explain Y.',
      bloomLevel: 'understand',
      isGeneratedDefault: false,
    },
    {
      id: 'OBJ-03',
      text: 'Assess Z.',
      bloomLevel: 'evaluate',
      isGeneratedDefault: true,
    },
  ]
)

// A synthesized objective without a Bloom level still renders as a default.
assert.deepEqual(
  designReviewObjectives([
    {
      id: 'OBJ-01',
      text: 'Assess the material.',
      bloomLevel: null,
      objectiveSource: 'neutral',
    },
  ]),
  [
    {
      id: 'OBJ-01',
      text: 'Assess the material.',
      bloomLevel: null,
      isGeneratedDefault: true,
    },
  ]
)
