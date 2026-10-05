import { describe, expect, it } from 'vitest'
import {
  type AdaptiveTestingHistoryResponse,
  buildAdaptiveTestingHistory,
  classifyAdaptiveTestingAnswer,
} from '../src/services/adaptivePracticeQuizTestingHistory.js'
import type {
  AdaptiveTestingEstimateRecord,
  AdaptiveTestingLevelResolver,
} from '../src/services/adaptivePracticeQuizTestingInfo.js'

const levelBands = ['A1', 'A2', 'B1', 'B2'].map((label, order) => ({
  label,
  order,
  startPosition: order / 4,
  endPosition: (order + 1) / 4,
}))
const resolver: AdaptiveTestingLevelResolver = {
  intervalZ: 2,
  labelForLevelId: (levelId) => (levelId === 3 ? 'B1' : null),
  tentativeLabel: (estimate) => (estimate.theta === null ? null : 'B2'),
}
const normalizeTheta = (theta: number) =>
  Math.min(1, Math.max(0, (theta + 3) / 6))

function response(
  order: number,
  overrides: Partial<AdaptiveTestingHistoryResponse> = {}
): AdaptiveTestingHistoryResponse {
  return {
    order,
    score: 1,
    correct: true,
    elementId: 100 + order,
    overallThetaAfter: null,
    poolItem: {
      elementName: `item-${order}`,
      nodePath: [1, 11],
      nodeNamePath: ['Grammar', 'Tenses'],
      levelLabel: 'A2',
    },
    ...overrides,
  }
}

function rootEstimate(
  overrides: Partial<AdaptiveTestingEstimateRecord>
): AdaptiveTestingEstimateRecord {
  return {
    nodeKind: 'COMPETENCE',
    nodeId: 1,
    theta: 0.6,
    standardError: 0.3,
    credibleLower: null,
    credibleUpper: null,
    responseCount: 3,
    levelId: 3,
    resultStatus: null,
    bandProbabilities: null,
    ...overrides,
  } as AdaptiveTestingEstimateRecord
}

const input = {
  responses: [response(1)],
  estimates: [rootEstimate({})],
  levelBands,
  normalizeTheta,
  resolver,
}

describe('adaptive testing answer history', () => {
  it('stays hidden unless the testing flag is exactly true', () => {
    for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
      expect(
        buildAdaptiveTestingHistory({ ...input, showSolutions: flag })
      ).toBeNull()
    }
  })

  it('classifies stored correctness and partial scores', () => {
    expect(classifyAdaptiveTestingAnswer({ correct: true, score: 1 })).toBe(
      'CORRECT'
    )
    expect(classifyAdaptiveTestingAnswer({ correct: false, score: 0.5 })).toBe(
      'PARTIALLY_CORRECT'
    )
    expect(classifyAdaptiveTestingAnswer({ correct: false, score: 0 })).toBe(
      'INCORRECT'
    )
    expect(
      classifyAdaptiveTestingAnswer({ correct: false, score: Number.NaN })
    ).toBe('INCORRECT')
  })

  it('maps answers in order with item level, result, and stored overall estimate', () => {
    const history = buildAdaptiveTestingHistory({
      ...input,
      responses: [
        response(2, {
          correct: false,
          score: 0,
          overallThetaAfter: 0,
          poolItem: {
            elementName: 'lex-2',
            nodePath: [2, 21],
            nodeNamePath: ['Vocabulary', 'Science'],
            levelLabel: 'B2',
          },
        }),
        response(1),
        response(3, { poolItem: null, correct: false, score: 0.25 }),
      ],
      estimates: [
        rootEstimate({}),
        rootEstimate({ nodeId: 2, levelId: null, theta: -3, responseCount: 1 }),
        rootEstimate({ nodeKind: 'OVERALL', nodeId: null }),
      ],
      showSolutions: 'true',
    })!
    expect(history.levelBands).toEqual(levelBands)
    expect(history.entries).toEqual([
      {
        order: 1,
        elementTitle: 'item-1',
        competenceName: 'Grammar',
        subcompetenceName: 'Tenses',
        itemLevelLabel: 'A2',
        itemLevelPosition: 0.375,
        result: 'CORRECT',
        score: 1,
        overallTheta: null,
        overallPosition: null,
      },
      {
        order: 2,
        elementTitle: 'lex-2',
        competenceName: 'Vocabulary',
        subcompetenceName: 'Science',
        itemLevelLabel: 'B2',
        itemLevelPosition: 0.875,
        result: 'INCORRECT',
        score: 0,
        overallTheta: 0,
        overallPosition: 0.5,
      },
      {
        order: 3,
        elementTitle: '#103',
        competenceName: null,
        subcompetenceName: null,
        itemLevelLabel: null,
        itemLevelPosition: null,
        result: 'PARTIALLY_CORRECT',
        score: 0.25,
        overallTheta: null,
        overallPosition: null,
      },
    ])
    expect(history.competenceEstimates).toEqual([
      {
        name: 'Grammar',
        responseCount: 3,
        theta: 0.6,
        levelLabel: 'B1',
        levelIsTentative: false,
        position: normalizeTheta(0.6),
        lowerPosition: normalizeTheta(0),
        upperPosition: normalizeTheta(1.2),
      },
      {
        name: 'Vocabulary',
        responseCount: 1,
        theta: -3,
        levelLabel: 'B2',
        levelIsTentative: true,
        position: 0,
        lowerPosition: 0,
        upperPosition: normalizeTheta(-2.4),
      },
    ])
  })

  it('omits competences without an estimate and handles an empty attempt', () => {
    expect(
      buildAdaptiveTestingHistory({
        ...input,
        estimates: [],
        showSolutions: 'true',
      })!.competenceEstimates
    ).toEqual([])
    expect(
      buildAdaptiveTestingHistory({
        ...input,
        responses: [],
        showSolutions: 'true',
      })
    ).toEqual({ levelBands, entries: [], competenceEstimates: [] })
  })
})
