import { randomUUID } from 'node:crypto'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  claimElementGenerationSpend,
  createElementGenerationBuildWithSpend,
  releaseUnclaimedElementGenerationSpend,
  settleElementGenerationSpend,
} from '../src/services/elementGenerationAccounting.js'
import { questionGenerationServiceError } from '../src/services/questionGenerationErrors.js'

const fixture = vi.hoisted(() => ({ graphId: '', configuration: {} }))
vi.mock('../src/services/questionGenerationGraph.js', () => ({
  assertQuestionGenerationPreviewAccess: async () => undefined,
  questionGenerationSourceSnapshot: () => [],
}))
vi.mock('../src/services/elementGenerationProvider.js', async (original) => ({
  ...(await original<
    typeof import('../src/services/elementGenerationProvider.js')
  >()),
  loadReadyElementGenerationGraph: async () => ({ id: fixture.graphId }),
}))
vi.mock('../src/services/questionGenerationConfiguration.js', () => ({
  QuestionGenerationConfigurationError: class extends Error {},
  normalizeQuestionGenerationConfiguration: () => ({
    configuration: fixture.configuration,
    configurationHash: 'failure-ordering',
  }),
}))
vi.mock('../src/services/flashcardGenerationConfiguration.js', () => ({
  FlashcardGenerationConfigurationError: class extends Error {},
  normalizeFlashcardGenerationConfiguration: () => ({
    configuration: fixture.configuration,
    configurationHash: 'failure-ordering',
  }),
}))
vi.mock('../src/services/flashcardGenerationBlueprint.js', () => ({
  createFlashcardGenerationBlueprint: () => Buffer.from('{}'),
}))
vi.mock('../src/services/questionGenerationBlueprint.js', () => ({
  createQuestionGenerationBlueprint: async () => Buffer.from('{}'),
}))

import {
  retryFlashcardGeneration,
  startFlashcardGeneration,
} from '../src/services/flashcardGeneration.js'
import { startQuestionGeneration } from '../src/services/questionGeneration.js'

const costEnv = {
  KB_GRAPH_COST_CURRENCY: 'CHF',
  KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '70',
  KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS: '90',
  KB_GRAPH_MAX_COST_MINOR_UNITS: '90',
  KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '100',
  KB_GRAPH_COST_PRICING_VERSION: 'graph-test-v1',
  KB_GRAPH_SEMESTER_KEY: '2026-H2',
  KB_ELEMENT_GENERATION_QUESTION_COST_MINOR_UNITS: '40',
  KB_ELEMENT_GENERATION_FLASHCARD_COST_MINOR_UNITS: '30',
  KB_ELEMENT_GENERATION_FLASHCARD_RETRY_COST_MINOR_UNITS: '10',
  KB_ELEMENT_GENERATION_COST_PRICING_VERSION: 'elements-test-v1',
}

function barrier() {
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  return { ready, release }
}
async function bounded<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Test barrier did not complete')),
          4000
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

let prisma: DB.PrismaClient
beforeAll(async () => {
  prisma = await createDisposableTestPrismaClient(process.env.DATABASE_URL!)
})
afterAll(async () => {
  await prisma?.$disconnect()
})

describe('generation start failure ordering', () => {
  it.each(
    (['question', 'flashcard', 'retry'] as const).flatMap((kind) =>
      (
        [
          'terminal',
          'retryable',
          'claimed',
          'settled',
          'released',
          'stale',
          'foreign',
          'rollback',
        ] as const
      ).map((mode) => ({ kind, mode }))
    )
  )('records $kind $mode failure before lease cleanup', async ({
    kind,
    mode,
  }) => {
    await requireDisposableDatabase(prisma)
    const ownerId = randomUUID()
    const otherOwnerId = randomUUID()
    const kbId = randomUUID()
    const buildId = randomUUID()
    fixture.graphId = randomUUID()
    const entered = barrier()
    const proceed = barrier()
    let cleanupStarted = false
    let spendUpdated = false
    let resultCount: number | undefined
    let operation: Promise<unknown> | undefined
    try {
      await prisma.user.create({
        data: {
          id: ownerId,
          email: `${ownerId}@example.org`,
          shortname: `failure-${ownerId.slice(0, 8)}`,
        },
      })
      await prisma.kB.create({
        data: { id: kbId, ownerId, name: 'Synthetic failure ordering' },
      })
      await prisma.kBGraphBuild.create({
        data: {
          id: fixture.graphId,
          kbId,
          requestedById: ownerId,
          sourceContentDigest: 'a'.repeat(64),
          graphName: `synthetic:${fixture.graphId}`,
        },
      })
      await createElementGenerationBuildWithSpend(prisma, {
        ownerId,
        idempotencyKey: buildId,
        spendClass:
          kind === 'question'
            ? DB.KBGraphQuotaSpendClass.QUESTION_GENERATION
            : DB.KBGraphQuotaSpendClass.FLASHCARD_GENERATION,
        data: {
          id: buildId,
          ownerId,
          sourceGraphBuildId: fixture.graphId,
          elementType:
            kind === 'question' ? DB.ElementType.SC : DB.ElementType.FLASHCARD,
          idempotencyKey: buildId,
          configurationHash: 'failure-ordering',
          configuration:
            kind === 'question'
              ? {
                  itemType: 'SC',
                  language: 'en',
                  questionCount: 1,
                  difficultyPreset: 'D1',
                  difficultyCounts: { d1: 1, d2: 0, d3: 0, d4: 0, d5: 0 },
                  sourceScopes: [],
                  objectives: [],
                  bloomLevels: ['remember'],
                }
              : { language: 'en', flashcardCount: 1, objectives: [] },
          requestedElementCount: 1,
        },
        env: costEnv,
        now: new Date('2026-09-08T12:00:00Z'),
      })
      const initialSpend = await prisma.elementGenerationSpend.findFirstOrThrow(
        { where: { buildId } }
      )
      if (kind === 'retry') {
        for (const [key, value] of Object.entries(costEnv))
          vi.stubEnv(key, value)
        await claimElementGenerationSpend(
          prisma,
          initialSpend.dispatchAttemptId
        )
        await settleElementGenerationSpend(
          prisma,
          initialSpend.dispatchAttemptId
        )
        await prisma.elementGenerationBuild.update({
          where: { id: buildId },
          data: {
            status:
              DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
            errorCode: 'PRIOR_FAILURE',
            errorMessage: 'Synthetic prior failure',
            completedAt: new Date('2026-09-07T00:00:00Z'),
          },
        })
      }
      const priorSpend = await prisma.elementGenerationSpend.findFirstOrThrow({
        where: { buildId },
      })
      const draft = await prisma.generatedElementDraft.create({
        data: {
          buildId,
          sourceElementId: 'synthetic',
          order: 0,
          elementType:
            kind === 'question' ? DB.ElementType.SC : DB.ElementType.FLASHCARD,
          original: {} as never,
          current: {} as never,
          citations: [],
        },
      })
      const observed = prisma.$extends({
        query: {
          elementGenerationBuild: {
            async updateMany({ args, query }) {
              if (
                args.data.errorCode ||
                args.data.stage === 'awaiting_incomplete_publication'
              ) {
                // Pause before the query can acquire a row lock.
                entered.release()
                await bounded(proceed.ready)
                const result = await query(args)
                resultCount = result.count
                return result
              }
              if (args.data.syncLeaseOwner === null && !args.data.status)
                cleanupStarted = true
              const result = await query(args)
              return result
            },
          },
          elementGenerationSpend: {
            async updateMany({ args, query }) {
              const result = await query(args)
              if (
                args.data.costStatus === DB.KBGraphCostStatus.RELEASED &&
                result.count === 1
              )
                spendUpdated = true
              return result
            },
          },
        },
      })
      const failure = questionGenerationServiceError(
        'ARTIFACT_INVALID',
        'Synthetic upload failure',
        mode === 'retryable'
      )
      const ctx = {
        prisma: observed,
        user: { sub: ownerId },
        elementGenerationRuntime: {
          questionInputContainer: 'synthetic',
          uploadCreateOnly: async () => {
            throw failure
          },
          startFlashcards: vi.fn(),
          publishIncompleteFlashcards: vi.fn(),
          findRunByFlashcardBuildId: vi.fn(),
        },
      } as unknown as ContextWithUser
      const start =
        kind === 'question' ? startQuestionGeneration : startFlashcardGeneration
      operation = (
        kind === 'retry'
          ? retryFlashcardGeneration(buildId, ctx)
          : start(
              {
                graphBuildId: fixture.graphId,
                idempotencyKey: buildId,
              } as never,
              ctx
            )
      ).catch((error) => error)
      await bounded(entered.ready)
      const activeBuild = await prisma.elementGenerationBuild.findUniqueOrThrow(
        { where: { id: buildId } }
      )
      const activeSpend = await prisma.elementGenerationSpend.findUniqueOrThrow(
        { where: { dispatchAttemptId: activeBuild.providerDispatchAttemptId } }
      )
      if (mode === 'claimed' || mode === 'settled')
        await claimElementGenerationSpend(prisma, activeSpend.dispatchAttemptId)
      if (mode === 'settled')
        await settleElementGenerationSpend(
          prisma,
          activeSpend.dispatchAttemptId
        )
      if (mode === 'released')
        await prisma.$transaction((tx) =>
          releaseUnclaimedElementGenerationSpend(
            tx,
            activeSpend.dispatchAttemptId
          )
        )
      if (mode === 'rollback')
        await prisma.kBGraphQuota.update({
          where: { id: activeSpend.quotaId },
          data: { reservedMinorUnits: 0 },
        })
      const spendBefore = await prisma.elementGenerationSpend.findUniqueOrThrow(
        { where: { dispatchAttemptId: activeSpend.dispatchAttemptId } }
      )
      const quotaBefore = await prisma.kBGraphQuota.findUniqueOrThrow({
        where: { id: activeSpend.quotaId },
      })
      // Release independently of cleanup, which must wait for this transaction.
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(cleanupStarted).toBe(false)
      const beforeFailure =
        await prisma.elementGenerationBuild.findUniqueOrThrow({
          where: { id: buildId },
        })
      expect(beforeFailure.syncLeaseOwner).not.toBeNull()
      if (mode === 'stale')
        await prisma.elementGenerationBuild.update({
          where: { id: buildId },
          data: { syncLeaseOwner: 'replacement-lease' },
        })
      if (mode === 'foreign') {
        await prisma.user.create({
          data: {
            id: otherOwnerId,
            email: `${otherOwnerId}@example.org`,
            shortname: `foreign-${otherOwnerId.slice(0, 8)}`,
          },
        })
        await prisma.elementGenerationBuild.update({
          where: { id: buildId },
          data: { ownerId: otherOwnerId },
        })
      }
      proceed.release()
      const error = await operation
      if (mode === 'rollback')
        expect(error).toMatchObject({
          message: 'Element-generation quota could not be released',
        })
      else expect(error).toBe(failure)
      expect(resultCount).toBe(['stale', 'foreign'].includes(mode) ? 0 : 1)
      expect(cleanupStarted).toBe(true)
      const build = await prisma.elementGenerationBuild.findUniqueOrThrow({
        where: { id: buildId },
      })
      const spend = await prisma.elementGenerationSpend.findUniqueOrThrow({
        where: { dispatchAttemptId: activeSpend.dispatchAttemptId },
      })
      expect(build.status).toBe(
        ['retryable', 'stale', 'foreign', 'rollback'].includes(mode)
          ? DB.ElementGenerationBuildStatus.PREPARING_INPUT
          : kind === 'retry'
            ? DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION
            : DB.ElementGenerationBuildStatus.FAILED
      )
      expect(build.syncLeaseOwner).toBe(
        mode === 'stale' ? 'replacement-lease' : null
      )
      if (mode === 'terminal') {
        expect(spend.costStatus).toBe(DB.KBGraphCostStatus.RELEASED)
        if (kind !== 'retry') expect(build.errorCode).toBe(failure.code)
        expect(build.completedAt).not.toBeNull()
      } else {
        expect(spend).toEqual(spendBefore)
        expect(
          await prisma.kBGraphQuota.findUniqueOrThrow({
            where: { id: initialSpend.quotaId },
          })
        ).toEqual(quotaBefore)
      }
      expect(
        await prisma.generatedElementDraft.findUniqueOrThrow({
          where: { id: draft.id },
        })
      ).toEqual(draft)
      if (kind === 'retry' && mode !== 'retryable') {
        expect(build.errorCode).toBe('PRIOR_FAILURE')
        expect(build.completedAt).toEqual(new Date('2026-09-07T00:00:00Z'))
        expect(
          await prisma.elementGenerationSpend.findUniqueOrThrow({
            where: { id: priorSpend.id },
          })
        ).toEqual(priorSpend)
      }
      if (mode === 'retryable') expect(build.errorRetryable).toBe(true)
      if (mode === 'rollback') {
        expect(spendUpdated).toBe(true)
        expect(build.errorCode).toBe(beforeFailure.errorCode)
        expect(build.completedAt).toEqual(beforeFailure.completedAt)
      }
    } finally {
      proceed.release()
      await bounded(operation ?? Promise.resolve())
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, otherOwnerId] } },
      })
      vi.unstubAllEnvs()
    }
  })
})
