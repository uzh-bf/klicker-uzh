import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { describe, expect, it, vi } from 'vitest'
import { resolvePresetSettings } from '../src/services/adaptivePracticeQuizConfigSettings.js'
import { assertAdaptiveEngineSupportsRetakeContext } from '../src/services/adaptivePracticeQuizEngineCapabilities.js'
import {
  buildAdaptiveDecisionRequest,
  type LoadedAdaptiveEstimator,
} from '../src/services/adaptivePracticeQuizEstimatorVersions.js'
import {
  loadAdaptiveRetakeContext,
  toAdaptiveRetakeRequest,
} from '../src/services/adaptivePracticeQuizRetakeContext.js'
import type { LoadedAdaptiveRuntime } from '../src/services/adaptivePracticeQuizRuntimeData.js'

// Synthetic topology: roots 1 and 10 (10 disabled) with one leaf each.
const nodes = [
  { id: 1, parentId: null, enabled: true },
  { id: 2, parentId: 1, enabled: true },
  { id: 10, parentId: null, enabled: false },
  { id: 11, parentId: 10, enabled: true },
].map((node) => ({
  ...node,
  kind: node.parentId === null ? 'COMPETENCE' : 'SUBCOMPETENCE',
  depth: node.parentId === null ? 1 : 2,
  order: 0,
  weight: node.parentId === null ? 1 : null,
  questionCap: null,
})) as LoadedAdaptiveEstimator['algorithm']['nodes']
const pool = [
  { id: 101, sourceAssignmentId: 7, elementId: 70 },
  { id: 102, sourceAssignmentId: 8, elementId: 80 },
  { id: 103, sourceAssignmentId: 9, elementId: 90 },
].map((item) => ({
  ...item,
  leafNodeId: 2,
  nodePath: [1, 2],
  levelId: 1,
  discrimination: 1.2,
  difficulty: 0,
  guessing: 0.25,
}))
const settings = {
  totalQuestionCap: 20,
  perLeafQuestionCap: null,
  minQuestionsPerLeaf: 1,
  classificationZ: 1.28,
  topInformationRatio: 0.8,
  levelMappingRule: 'NEAREST' as const,
  thetaRange: { min: -3, max: 3 },
}
const levels = [
  { id: 1, label: 'Basic', order: 0 },
  { id: 2, label: 'Advanced', order: 1 },
]
const estimator = {
  measurementVersion: 'IRT_V1',
  algorithm: { nodes, levels, pool, settings },
} as unknown as LoadedAdaptiveEstimator

function runtime(
  publication: Partial<DB.PracticeQuizAdaptivePublication>,
  measurementVersion: DB.AdaptiveMeasurementVersion = DB
    .AdaptiveMeasurementVersion.IRT_V1
) {
  return {
    quiz: { id: 'quiz-1' },
    publication: {
      retakeStartFromPreviousResult: true,
      retakeStartMaxAgeDays: 30,
      retakePreferNewQuestions: true,
      ...publication,
    },
    pool,
    estimator: { ...estimator, measurementVersion },
  } as unknown as LoadedAdaptiveRuntime
}

function prisma({
  previous = null,
  answered = [],
}: {
  previous?: {
    id: string
    estimates: Array<{ nodeId: number | null; theta: number | null }>
  } | null
  answered?: Array<{ assignmentId: number; elementId: number }>
} = {}) {
  const findFirst = vi.fn().mockResolvedValue(previous)
  const findMany = vi.fn().mockResolvedValue(answered)
  return {
    client: {
      adaptivePracticeQuizAttempt: { findFirst },
      adaptivePracticeQuizResponse: { findMany },
    } as unknown as PrismaTransactionClient,
    findFirst,
    findMany,
  }
}

describe('retake context snapshot', () => {
  const now = new Date('2026-10-07T12:00:00Z')

  it('starts at the latest recent result and marks answered items as seen', async () => {
    const db = prisma({
      previous: {
        id: 'attempt-0',
        estimates: [
          { nodeId: 1, theta: 1.4 },
          // a disabled root is not carried over
          { nodeId: 10, theta: -1 },
        ],
      },
      answered: [
        { assignmentId: 7, elementId: 70 },
        { assignmentId: 9, elementId: 90 },
        // an element that is no longer in the pool
        { assignmentId: 4, elementId: 40 },
      ],
    })
    await expect(
      loadAdaptiveRetakeContext({
        prisma: db.client,
        runtime: runtime({ retakeStartMaxAgeDays: 30 }),
        participantId: 'participant-1',
        now,
      })
    ).resolves.toEqual({
      sourceAttemptId: 'attempt-0',
      startingEstimates: [{ nodeId: 1, theta: 1.4 }],
      seenPoolItemIds: [101, 103],
    })
    expect(db.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          participantId: 'participant-1',
          practiceQuizId: 'quiz-1',
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          completedAt: { gte: new Date('2026-09-07T12:00:00Z') },
        }),
        orderBy: { completedAt: 'desc' },
      })
    )
  })

  it('returns null on a first attempt', async () => {
    await expect(
      loadAdaptiveRetakeContext({
        prisma: prisma().client,
        runtime: runtime({}),
        participantId: 'participant-1',
        now,
      })
    ).resolves.toBeNull()
  })

  it('follows each publication setting separately', async () => {
    const previous = { id: 'attempt-0', estimates: [{ nodeId: 1, theta: 1 }] }
    const answered = [{ assignmentId: 8, elementId: 80 }]
    const startOnly = prisma({ previous, answered })
    await expect(
      loadAdaptiveRetakeContext({
        prisma: startOnly.client,
        runtime: runtime({ retakePreferNewQuestions: false }),
        participantId: 'participant-1',
        now,
      })
    ).resolves.toEqual({
      sourceAttemptId: 'attempt-0',
      startingEstimates: [{ nodeId: 1, theta: 1 }],
      seenPoolItemIds: [],
    })
    expect(startOnly.findMany).not.toHaveBeenCalled()

    const seenOnly = prisma({ previous, answered })
    await expect(
      loadAdaptiveRetakeContext({
        prisma: seenOnly.client,
        runtime: runtime({ retakeStartFromPreviousResult: false }),
        participantId: 'participant-1',
        now,
      })
    ).resolves.toEqual({
      sourceAttemptId: null,
      startingEstimates: [],
      seenPoolItemIds: [102],
    })
    expect(seenOnly.findFirst).not.toHaveBeenCalled()
  })

  it('is off for publications without the settings and for IRT v2', async () => {
    const db = prisma({
      previous: { id: 'attempt-0', estimates: [{ nodeId: 1, theta: 1 }] },
    })
    for (const loaded of [
      runtime({
        retakeStartFromPreviousResult: false,
        retakePreferNewQuestions: false,
      }),
      runtime({}, DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1),
    ]) {
      await expect(
        loadAdaptiveRetakeContext({
          prisma: db.client,
          runtime: loaded,
          participantId: 'participant-1',
          now,
        })
      ).resolves.toBeNull()
    }
    expect(db.findFirst).not.toHaveBeenCalled()
  })
})

describe('retake context in the engine request', () => {
  const build = (
    retakeContext: PrismaJson.PrismaAdaptiveRetakeContext | null
  ) =>
    buildAdaptiveDecisionRequest({
      attemptId: '11111111-1111-4111-8111-111111111111',
      runtime: estimator,
      responses: [],
      retake: toAdaptiveRetakeRequest(retakeContext),
    })

  it('is sent only when there is something to carry over', () => {
    expect('retake' in build(null)).toBe(false)
    expect(
      'retake' in
        build({
          sourceAttemptId: null,
          startingEstimates: [],
          seenPoolItemIds: [],
        })
    ).toBe(false)
    expect(
      build({
        sourceAttemptId: 'attempt-0',
        startingEstimates: [{ nodeId: 1, theta: 0.5 }],
        seenPoolItemIds: [101],
      })
    ).toMatchObject({
      retake: {
        startingEstimates: [{ nodeId: 1, theta: 0.5 }],
        seenPoolItemIds: [101],
      },
    })
  })
})

describe('retake settings', () => {
  const resolve = (retakeStartMaxAgeDays?: number) =>
    resolvePresetSettings(
      {
        competenceTreeId: 'tree',
        preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
        retakeStartMaxAgeDays,
      },
      {
        defaultDiscrimination: 1.2,
        defaultTotalQuestionCap: 50,
        defaultTimeLimitSeconds: null,
      }
    )

  it('defaults to on with a 30-day limit and validates the limit', () => {
    expect(resolve()).toMatchObject({
      retakeStartFromPreviousResult: true,
      retakeStartMaxAgeDays: 30,
      retakePreferNewQuestions: true,
    })
    expect(resolve(365).retakeStartMaxAgeDays).toBe(365)
    for (const invalid of [0, 366, 1.5])
      expect(() => resolve(invalid)).toThrow(
        expect.objectContaining({
          extensions: { code: 'ADAPTIVE_RETAKE_START_MAX_AGE_INVALID' },
        })
      )
  })
})

describe('engine support guard for the retake context', () => {
  const engine = (rejectRetake: boolean, unavailable = false) => ({
    calls: [] as boolean[],
    async decide(request: object) {
      this.calls.push('retake' in request)
      if (unavailable) throw new Error('down')
      if (rejectRetake && 'retake' in request) throw new Error('invalid')
      return {} as never
    },
  })

  it('does not probe the engine when the settings are off', async () => {
    const decider = engine(true)
    await assertAdaptiveEngineSupportsRetakeContext(false, decider)
    expect(decider.calls).toEqual([])
  })

  it('accepts an engine that supports the context', async () => {
    const decider = engine(false)
    await assertAdaptiveEngineSupportsRetakeContext(true, decider)
    expect(decider.calls).toEqual([false, true])
  })

  it('reports an older or unavailable engine clearly', async () => {
    await expect(
      assertAdaptiveEngineSupportsRetakeContext(true, engine(true))
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_RETAKE_CONTEXT_UNSUPPORTED' },
    })
    await expect(
      assertAdaptiveEngineSupportsRetakeContext(true, engine(true, true))
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_ENGINE_UNAVAILABLE' },
    })
  })
})
