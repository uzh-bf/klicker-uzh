import { describe, expect, it } from 'vitest'
import type {
  AdaptiveAttemptRuntimeRecord,
  LoadedAdaptiveRuntime,
} from '../src/services/adaptivePracticeQuizRuntimeData.js'
import { buildAttemptTestingHistory } from '../src/services/adaptivePracticeQuizTestingAttemptView.js'

// Minimal legacy runtime: only the fields the history mapping reads.
const runtime = {
  estimator: { measurementVersion: 'LEGACY' },
  algorithm: {
    levels: ['A1', 'A2', 'B1'].map((label, order) => ({
      id: order + 1,
      label,
      order,
    })),
    settings: {
      thetaRange: { min: -3, max: 3 },
      levelMappingRule: 'NEAREST',
    },
  },
  publication: { evidenceMinimumSnapshot: { classificationZ: 1.96 } },
  tree: { levels: [] },
  pool: [{ levelId: 2 }],
} as unknown as LoadedAdaptiveRuntime

const attempt = {
  responses: [
    {
      order: 1,
      score: 1,
      correct: true,
      elementId: 7,
      overallThetaAfter: 0.4,
      poolItem: {
        elementName: 'item-1',
        nodePath: [1, 11],
        nodeNamePath: ['Grammar', 'Tenses'],
        levelLabel: 'A2',
      },
    },
  ],
  estimates: [],
} as unknown as AdaptiveAttemptRuntimeRecord

describe('adaptive result answer history', () => {
  it('is null on the result unless ADAPTIVE_QUIZ_SHOW_SOLUTIONS is exactly true', () => {
    for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
      expect(buildAttemptTestingHistory(runtime, attempt, flag)).toBeNull()
    }
  })

  it('maps the attempt answers when the testing flag is on', () => {
    const history = buildAttemptTestingHistory(runtime, attempt, 'true')
    expect(history?.levelBands.map(({ label }) => label)).toEqual([
      'A1',
      'A2',
      'B1',
    ])
    expect(history?.entries).toMatchObject([
      {
        order: 1,
        elementTitle: 'item-1',
        competenceName: 'Grammar',
        subcompetenceName: 'Tenses',
        itemLevelLabel: 'A2',
        result: 'CORRECT',
      },
    ])
  })
})
