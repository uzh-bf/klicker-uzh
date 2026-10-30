import { describe, expect, it, vi } from 'vitest'
import {
  summarizeAdaptiveDryRun,
  summarizeAdaptiveDryRunSubcompetences,
} from '../src/services/adaptivePracticeQuizDryRunSummary.js'
import {
  adaptiveDryRunEngineSeed,
  buildAdaptiveDryRunSpec,
  getAdaptivePracticeQuizDryRuns,
  runAdaptivePracticeQuizDryRun,
  splitAdaptiveDryRunRequest,
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
  levelReachedFrom: 0.7,
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

describe('dry-run subcompetence summary', () => {
  it('counts answers, coverage, rough deviation and pool gaps per leaf', () => {
    const base = student(1, 2, [[2, true]], 2)
    const students = [
      {
        ...base,
        answers: [answer(1), answer(2)],
        subcompetences: [
          {
            nodeId: 2,
            responseCount: 2,
            levelId: 3,
            coverageStatus: 'COVERED',
          },
          {
            nodeId: 3,
            responseCount: 0,
            levelId: null,
            coverageStatus: 'NOT_SAMPLED',
          },
        ],
      },
      {
        ...base,
        index: 2,
        answers: [answer(1)],
        subcompetences: [
          {
            nodeId: 2,
            responseCount: 4,
            levelId: 2,
            coverageStatus: 'COVERED',
          },
          {
            nodeId: 3,
            responseCount: 1,
            levelId: null,
            coverageStatus: 'OUT_OF_RANGE',
          },
        ],
      },
      // stored before the breakdown: no leaf rows
      { ...base, index: 3 },
    ]
    const pool = [
      { id: 1, leafNodeId: 2, levelId: 1 },
      { id: 2, leafNodeId: 2, levelId: 2 },
      { id: 3, leafNodeId: 2, levelId: 2 },
      // counts for leaf 3 through an additional mapping
      { id: 4, leafNodeId: 2, additionalLeafNodeIds: [3], levelId: 3 },
    ]
    const [leaf2, leaf3] = summarizeAdaptiveDryRunSubcompetences({
      students,
      levels,
      leaves: [
        { nodeId: 2, rootId: 1 },
        { nodeId: 3, rootId: 1 },
      ],
      pool,
    })
    expect(leaf2).toMatchObject({
      meanAnswers: 3,
      minAnswers: 2,
      coverage: { COVERED: 2, NOT_SAMPLED: 0, OUT_OF_RANGE: 0 },
      estimatedCount: 2,
      // true level 2: reported 3 (+1) and 2 (0)
      meanDeviation: 0.5,
      pool: [
        { levelId: 1, count: 1, used: 1 },
        { levelId: 2, count: 2, used: 1 },
        { levelId: 3, count: 1, used: 0 },
      ],
    })
    expect(leaf3).toMatchObject({
      meanAnswers: 0.5,
      minAnswers: 0,
      coverage: { COVERED: 0, NOT_SAMPLED: 1, OUT_OF_RANGE: 1 },
      estimatedCount: 0,
      meanDeviation: null,
      pool: [
        { levelId: 1, count: 0, used: 0 },
        { levelId: 2, count: 0, used: 0 },
        { levelId: 3, count: 1, used: 0 },
      ],
    })
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
        // ideal students sit in the middle of their level
        idealOwnLevel: 'HALF',
      },
      settings: {
        totalQuestionCap: 20,
        minQuestionsPerLeaf: 2,
        classificationZ: 1.28,
        classificationToleranceBands: 0,
        levelReachedFrom: 0.7,
        // the share is the mastery mark only, never a band shift
        masteryMark: true,
      },
    })
    expect(
      buildAdaptiveDryRunSpec({ ...input, toLevelId: 1 }, levels, seed).spec
        .trueLevels
    ).toEqual({ kind: 'FIXED', levelId: 1 })
    expect(buildAdaptiveDryRunSpec(input, levels).spec.seed).toMatch(/^\d{6}$/)
    expect(
      buildAdaptiveDryRunSpec({ ...input, seed: ' class-2026 ' }, levels).spec
        .seed
    ).toBe('class-2026')
  })

  it('hands the engine a hexadecimal seed', () => {
    expect(adaptiveDryRunEngineSeed(seed)).toBe(seed)
    expect(adaptiveDryRunEngineSeed('42')).toMatch(/^[a-f0-9]{64}$/)
    expect(adaptiveDryRunEngineSeed('42')).toBe(adaptiveDryRunEngineSeed('42'))
    expect(adaptiveDryRunEngineSeed('42')).not.toBe(
      adaptiveDryRunEngineSeed('43')
    )
  })

  it('stores realistic answers without noise and omits the ideal default', () => {
    const realistic = buildAdaptiveDryRunSpec(
      { ...input, answerModel: 'REALISTIC' },
      levels,
      seed
    ).spec
    expect(realistic).toMatchObject({
      answerModel: 'REALISTIC',
      noiseProbability: 0,
    })
    expect(
      'answerModel' in
        buildAdaptiveDryRunSpec(
          { ...input, answerModel: 'IDEAL' },
          levels,
          seed
        ).spec
    ).toBe(false)
  })

  it('rejects inputs outside the engine bounds', () => {
    for (const invalid of [
      { students: 0 },
      { students: 201 },
      { noiseProbability: 0.6 },
      { students: 200, totalQuestionCap: 101 },
      { minQuestionsPerLeaf: 21 },
      { fromLevelId: 3, toLevelId: 1 },
      { fromLevelId: 99 },
      { classificationToleranceBands: 6 },
      { levelReachedFrom: 0.96 },
      { levelReachedFrom: -0.1 },
      { answerModel: 'RANDOM' },
      { seed: 'two words' },
      { seed: 'x'.repeat(65) },
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

describe('dry-run parts', () => {
  it('splits a run into parts of at most 2,500 decisions', () => {
    const request = {
      settings: { totalQuestionCap: 100 },
      dryRun: { students: 60, seed: 'a'.repeat(64) },
    } as never
    expect(
      splitAdaptiveDryRunRequest(request).map(({ dryRun }) => [
        dryRun.firstStudent,
        dryRun.students,
      ])
    ).toEqual([
      [0, 25],
      [25, 25],
      [50, 10],
    ])
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
