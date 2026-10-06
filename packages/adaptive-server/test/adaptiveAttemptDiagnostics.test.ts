import { describe, expect, it } from 'vitest'
import {
  getAdaptivePracticeQuizAttemptDiagnostic,
  getAdaptivePracticeQuizAttemptDiagnostics,
} from '../src/services/adaptivePracticeQuizAttemptDiagnostics.js'
import {
  type AdaptiveDiagnosticAttemptRecord,
  type AdaptiveDiagnosticContext,
  adaptivePseudonymCode,
  buildAdaptiveAttemptDiagnostic,
} from '../src/services/adaptivePracticeQuizAttemptDiagnosticsModel.js'
import {
  computeAdaptivePersonFit,
  rateAdaptiveAttempt,
} from '../src/services/adaptivePracticeQuizAttemptDiagnosticsRating.js'
import type {
  AdaptiveRuntimeNode,
  AdaptiveRuntimeRoutingPoolItem,
} from '../src/services/adaptivePracticeQuizRuntime.js'

// Synthetic scale: 6 levels evenly over theta -3..3, difficulty = band centre.
const levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].map((label, index) => ({
  id: index + 1,
  label,
  order: index,
  lowerBound: -3 + index,
  upperBound: -2 + index,
}))
const difficulty = (levelId: number) => -3 + levelId - 0.5

function node(id: number, parentId: number | null): AdaptiveRuntimeNode {
  return {
    id,
    parentId,
    kind: parentId === null ? 'COMPETENCE' : 'SUBCOMPETENCE',
    depth: parentId === null ? 1 : 2,
    order: id,
    enabled: true,
    weight: parentId === null ? 1 : null,
    questionCap: null,
  }
}

function item(id: number, levelId: number): AdaptiveRuntimeRoutingPoolItem {
  return {
    id,
    leafNodeId: 11,
    nodePath: [1, 11],
    levelId,
    discrimination: 1.2,
    difficulty: difficulty(levelId),
    guessing: 0,
    sourceAssignmentId: id,
    elementId: 100 + id,
    elementVersion: 1,
    elementType: 'SC',
    elementName: `item-${id}`,
    nodeNamePath: ['Synthetic competence', 'Synthetic leaf'],
    levelLabel: `L${levelId}`,
    levelOrder: levelId - 1,
    enablePercentInput: false,
  } as AdaptiveRuntimeRoutingPoolItem
}

const pool = [1, 2, 3, 4, 5, 6].map((levelId) => item(levelId, levelId))
const context: AdaptiveDiagnosticContext = {
  nodes: [node(1, null), node(11, 1)],
  nodeNames: new Map([
    [1, 'Synthetic competence'],
    [11, 'Synthetic leaf'],
  ]),
  levels,
  settings: {
    totalQuestionCap: 10,
    perLeafQuestionCap: null,
    minQuestionsPerLeaf: 2,
    classificationZ: 1.96,
    topInformationRatio: 0.8,
    levelMappingRule: 'NEAREST',
    thetaRange: { min: -3, max: 3 },
  },
  poolById: new Map(pool.map((entry) => [entry.id, entry])),
  levelIdsWithElements: new Set([1, 2, 3, 4, 5, 6]),
  weightShares: new Map([[1, 1]]),
  isDetermined: () => false,
}

function attempt(
  answers: Array<[poolItemId: number, correct: boolean]>,
  theta: number
): AdaptiveDiagnosticAttemptRecord {
  return {
    id: 'attempt-1',
    participationId: 7,
    measurementVersion: 'IRT_V1',
    stopReason: 'TOTAL_QUESTION_CAP',
    startedAt: new Date('2026-10-06T10:00:00Z'),
    completedAt: new Date('2026-10-06T10:10:00Z'),
    elapsedSeconds: 600,
    estimates: [
      {
        nodeKind: 'OVERALL',
        nodeId: null,
        theta,
        standardError: 0.4,
        responseCount: answers.length,
        stopReason: 'TOTAL_QUESTION_CAP',
        coverageStatus: null,
      },
      {
        nodeKind: 'COMPETENCE',
        nodeId: 1,
        theta,
        standardError: 0.4,
        responseCount: answers.length,
        stopReason: 'TOTAL_QUESTION_CAP',
        coverageStatus: null,
      },
    ],
    responses: answers.map(([poolItemId, correct], index) => ({
      order: index + 1,
      poolItemId,
      elementId: 100 + poolItemId,
      correct,
      score: correct ? 1 : 0,
      overallThetaAfter: null,
    })),
  }
}

describe('adaptive attempt diagnostics', () => {
  it('uses stable pseudonymous codes without the raw ids', () => {
    const code = adaptivePseudonymCode('attempt', 'attempt-1')
    expect(code).toMatch(/^[0-9a-f]{8}$/)
    expect(code).toBe(adaptivePseudonymCode('attempt', 'attempt-1'))
    expect(code).not.toBe(adaptivePseudonymCode('participant', 'attempt-1'))
  })

  it('rates a consistent, well-targeted attempt as good', () => {
    // Right below L4, wrong above: consistent with theta in L4.
    const { summary, answers } = buildAdaptiveAttemptDiagnostic(
      context,
      attempt(
        [
          [3, true],
          [4, true],
          [5, false],
          [3, true],
          [4, false],
          [5, false],
        ],
        0.3
      ),
      1
    )
    expect(summary.overall.levelLabel).toBe('L4')
    expect(answers.map(({ levelDistance }) => levelDistance)).toEqual([
      -1, 0, 1, -1, 0, 1,
    ])
    expect(summary.ratingReasons.map(({ code }) => code)).not.toContain(
      'PERSON_FIT'
    )
    expect(summary.ratingReasons.map(({ code }) => code)).not.toContain(
      'TARGETING'
    )
  })

  it('flags contradictory answers as unreliable person fit', () => {
    // Hard items right, easy items wrong.
    const { summary } = buildAdaptiveAttemptDiagnostic(
      context,
      attempt(
        [
          [6, true],
          [1, false],
          [6, true],
          [1, false],
          [5, true],
          [2, false],
        ],
        0
      ),
      1
    )
    expect(summary.rating).toBe('UNRELIABLE')
    expect(
      summary.ratingReasons.find(({ code }) => code === 'PERSON_FIT')
    ).toMatchObject({
      severity: 'UNRELIABLE',
      nodeName: 'Synthetic competence',
    })
  })

  it('flags an estimate at the scale clamp and low coverage', () => {
    const { summary } = buildAdaptiveAttemptDiagnostic(
      context,
      attempt(
        [
          [1, false],
          [2, false],
        ],
        -3
      ),
      2
    )
    expect(summary.attemptNumber).toBe(2)
    expect(summary.ratingReasons.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['EDGE_CLAMP', 'COVERAGE_LOW'])
    )
  })

  it('computes a positive person fit for a model-consistent pattern', () => {
    const lz = computeAdaptivePersonFit(0, [
      {
        item: { difficulty: -2, discrimination: 1.2, guessing: 0 },
        correct: true,
      },
      {
        item: { difficulty: 2, discrimination: 1.2, guessing: 0 },
        correct: false,
      },
      {
        item: { difficulty: -1, discrimination: 1.2, guessing: 0 },
        correct: true,
      },
      {
        item: { difficulty: 1, discrimination: 1.2, guessing: 0 },
        correct: false,
      },
    ])
    expect(lz).not.toBeNull()
    expect(lz!).toBeGreaterThan(0)
  })

  it('rates precision by the share of levels the range touches', () => {
    const rate = (count: number) =>
      rateAdaptiveAttempt({
        overallDetermined: false,
        overallRangeLevelCount: count,
        levelCount: 15,
        competences: [],
      })
    expect(rate(3).level).toBe('GOOD')
    expect(rate(5).reasons[0]?.code).toBe('PRECISION_MEDIUM')
    expect(rate(8).level).toBe('UNRELIABLE')
  })

  it('returns nothing outside testing environments', async () => {
    const ctx = {} as never
    await expect(
      getAdaptivePracticeQuizAttemptDiagnostics(
        { practiceQuizId: 'quiz' },
        ctx,
        ''
      )
    ).resolves.toBeNull()
    await expect(
      getAdaptivePracticeQuizAttemptDiagnostic(
        { practiceQuizId: 'quiz', attemptCode: 'abcd1234' },
        ctx,
        'false'
      )
    ).resolves.toBeNull()
  })
})
