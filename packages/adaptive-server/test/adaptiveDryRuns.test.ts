import { describe, expect, it, vi } from 'vitest'
import { summarizeAdaptiveDryRun } from '../src/services/adaptivePracticeQuizDryRunSummary.js'
import {
  buildAdaptiveDryRunSpec,
  getAdaptivePracticeQuizDryRuns,
  runAdaptivePracticeQuizDryRun,
} from '../src/services/adaptivePracticeQuizDryRuns.js'

// Synthetic scale: three levels, two competences (nodes 1 and 10).
const levels = [
  { id: 1, order: 0 },
  { id: 2, order: 1 },
  { id: 3, order: 2 },
]
const answer = (poolItemId: number, flipped = false) => ({
  poolItemId,
  levelId: 1,
  correct: true,
  flipped,
})
const student = (
  index: number,
  trueLevelId: number,
  reported: [number | null, boolean][],
  questionCount: number,
  stopReason = 'TOTAL_QUESTION_CAP'
) => ({
  index,
  trueLevels: [
    { nodeId: 1, levelId: trueLevelId },
    { nodeId: 10, levelId: trueLevelId },
  ],
  stopReason,
  questionCount,
  answers: Array.from({ length: questionCount }, (_, i) =>
    answer(100 + i, i === 0 && index === 1)
  ),
  overall: { theta: null, standardError: null, levelId: null },
  competences: reported.map(([levelId, classified], i) => ({
    nodeId: i === 0 ? 1 : 10,
    theta: null,
    standardError: null,
    levelId,
    classified,
  })),
})

const input = {
  students: 100,
  noiseProbability: 0.02,
  fromLevelId: 1,
  toLevelId: 3,
  competences: 'SAME_LEVEL' as const,
  totalQuestionCap: 20,
  minQuestionsPerLeaf: 2,
  classificationZ: 1.28,
  classificationToleranceBands: 0,
}

describe('dry-run summary', () => {
  it('measures accuracy, bias, stops and question use per pair', () => {
    const summary = summarizeAdaptiveDryRun({
      students: [
        // exact and exact
        student(
          1,
          2,
          [
            [2, true],
            [2, false],
          ],
          4,
          'ALL_ROOTS_CLASSIFIED'
        ),
        // one too high, two too low
        student(
          2,
          3,
          [
            [3, false],
            [1, false],
          ],
          2
        ),
        student(
          3,
          1,
          [
            [2, false],
            [null, false],
          ],
          6
        ),
      ],
      levels,
      poolSize: 10,
    })
    expect(summary.studentCount).toBe(3)
    // 6 pairs: errors 0, 0, 0, −2, +1 and one without a level.
    expect(summary.metrics.count).toBe(6)
    expect(summary.metrics.exactShare).toBeCloseTo(3 / 6)
    expect(summary.metrics.withinOneShare).toBeCloseTo(4 / 6)
    expect(summary.metrics.bias).toBeCloseTo(-1 / 5)
    expect(summary.metrics.meanAbsoluteError).toBeCloseTo(3 / 5)
    expect(summary.metrics.determinedShare).toBeCloseTo(1 / 6)
    expect(summary.competences.map(({ nodeId }) => nodeId)).toEqual([1, 10])
    expect(summary.questions).toEqual({ min: 2, median: 4, mean: 4, max: 6 })
    expect(summary.stopReasons).toEqual([
      { reason: 'TOTAL_QUESTION_CAP', count: 2 },
      { reason: 'ALL_ROOTS_CLASSIFIED', count: 1 },
    ])
    expect(summary.flippedShare).toBeCloseTo(1 / 12)
    expect(summary.confusion).toEqual([
      {
        trueLevelId: 1,
        reported: [
          { levelId: null, count: 1 },
          { levelId: 2, count: 1 },
        ],
      },
      { trueLevelId: 2, reported: [{ levelId: 2, count: 2 }] },
      {
        trueLevelId: 3,
        reported: [
          { levelId: 1, count: 1 },
          { levelId: 3, count: 1 },
        ],
      },
    ])
    expect(summary.itemUse).toMatchObject({ poolSize: 10, usedCount: 6 })
    expect(summary.itemUse.top[0]).toEqual({ poolItemId: 100, count: 3 })
  })
})

describe('dry-run spec', () => {
  const seed = 'a'.repeat(64)

  it('builds an even range or one fixed level and keeps the seed', () => {
    expect(buildAdaptiveDryRunSpec(input, levels, seed)).toEqual({
      spec: {
        students: 100,
        seed,
        noiseProbability: 0.02,
        trueLevels: { kind: 'EVEN', fromLevelId: 1, toLevelId: 3 },
        competences: 'SAME_LEVEL',
      },
      settings: {
        totalQuestionCap: 20,
        minQuestionsPerLeaf: 2,
        classificationZ: 1.28,
        classificationToleranceBands: 0,
      },
    })
    expect(
      buildAdaptiveDryRunSpec({ ...input, toLevelId: 1 }, levels, seed).spec
        .trueLevels
    ).toEqual({ kind: 'FIXED', levelId: 1 })
    expect(buildAdaptiveDryRunSpec(input, levels).spec.seed).toMatch(
      /^[a-f0-9]{64}$/
    )
  })

  it('rejects inputs outside the engine bounds', () => {
    for (const invalid of [
      { students: 0 },
      { students: 201 },
      { noiseProbability: 0.6 },
      { students: 200, totalQuestionCap: 51 },
      { minQuestionsPerLeaf: 21 },
      { fromLevelId: 3, toLevelId: 1 },
      { fromLevelId: 99 },
      { classificationToleranceBands: 6 },
      { seed: 'xyz' },
    ])
      expect(() =>
        buildAdaptiveDryRunSpec({ ...input, ...invalid }, levels)
      ).toThrow(
        expect.objectContaining({
          extensions: { code: 'ADAPTIVE_DRY_RUN_INVALID' },
        })
      )
  })
})

describe('dry-run gate', () => {
  it('returns null outside testing environments without loading data', async () => {
    const prisma = new Proxy(
      {},
      {
        get: () => {
          throw new Error('no database access expected')
        },
      }
    )
    const ctx = { prisma, user: { sub: 'user-1' } } as never
    const runEngine = vi.fn()
    await expect(
      getAdaptivePracticeQuizDryRuns({ practiceQuizId: 'quiz-1' }, ctx, 'false')
    ).resolves.toBeNull()
    await expect(
      runAdaptivePracticeQuizDryRun({ practiceQuizId: 'quiz-1', input }, ctx, {
        showSolutions: 'false',
        runEngine,
      })
    ).resolves.toBeNull()
    expect(runEngine).not.toHaveBeenCalled()
  })
})
