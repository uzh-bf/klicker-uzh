import { randomUUID } from 'node:crypto'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { createElementGenerationBuildWithSpend } from '../src/services/elementGenerationAccounting.js'
import { publishIncompleteFlashcardGeneration } from '../src/services/flashcardGeneration.js'
import { claimIncompleteFlashcardPublication } from '../src/services/flashcardPublicationLifecycle.js'
import { questionGenerationServiceError } from '../src/services/questionGenerationErrors.js'

vi.mock('../src/services/questionGenerationGraph.js', () => ({
  assertQuestionGenerationPreviewAccess: async () => undefined,
}))

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

let prisma: DB.PrismaClient
let ownerId: string | undefined
let otherOwnerId: string | undefined

beforeAll(async () => {
  prisma = await createDisposableTestPrismaClient(process.env.DATABASE_URL!)
})

afterEach(async () => {
  await requireDisposableDatabase(prisma)
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [ownerId, otherOwnerId].filter((id): id is string => Boolean(id)),
      },
    },
  })
  ownerId = undefined
  otherOwnerId = undefined
})

afterAll(async () => {
  await prisma?.$disconnect()
})

async function fixture() {
  await requireDisposableDatabase(prisma)
  ownerId = randomUUID()
  const graphBuildId = randomUUID()
  const buildId = randomUUID()
  const idempotencyKey = randomUUID()
  const startManifestArtifact = {
    containerName: 'synthetic-results',
    blobName: `flashcard-builds/${buildId}/manifest/start.json`,
    sha256: 'a'.repeat(64),
  }

  await prisma.user.create({
    data: {
      id: ownerId,
      email: `${ownerId}@example.org`,
      shortname: `publication-${ownerId.slice(0, 8)}`,
    },
  })
  const kbId = randomUUID()
  await prisma.kB.create({
    data: {
      id: kbId,
      ownerId,
      name: 'Synthetic publication recovery KB',
    },
  })
  await prisma.kBGraphBuild.create({
    data: {
      id: graphBuildId,
      kbId,
      requestedById: ownerId,
      sourceContentDigest: 'b'.repeat(64),
      graphName: `synthetic:${graphBuildId}`,
    },
  })
  await createElementGenerationBuildWithSpend(prisma, {
    ownerId,
    idempotencyKey,
    spendClass: DB.KBGraphQuotaSpendClass.FLASHCARD_GENERATION,
    data: {
      id: buildId,
      ownerId,
      sourceGraphBuildId: graphBuildId,
      elementType: DB.ElementType.FLASHCARD,
      idempotencyKey,
      configurationHash: 'synthetic-publication-recovery',
      configuration: { language: 'en', flashcardCount: 1, objectives: [] },
      requestedElementCount: 1,
      status: DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
      stage: 'awaiting_incomplete_publication',
      startManifestArtifact,
    },
    env: costEnv,
  })

  const dispatchFailure = new Error('Synthetic definitive dispatch failure')
  const runtime = {
    startFlashcards: vi.fn(),
    publishIncompleteFlashcards: vi.fn(async () => {
      throw dispatchFailure
    }),
    findRunByFlashcardBuildId: vi.fn(
      async (..._args: unknown[]): Promise<unknown> => null
    ),
  }
  const ctx = {
    prisma,
    user: { sub: ownerId },
    elementGenerationRuntime: runtime,
  } as unknown as ContextWithUser

  await prisma.generatedElementDraft.create({
    data: {
      buildId,
      sourceElementId: 'synthetic',
      order: 0,
      elementType: DB.ElementType.FLASHCARD,
      original: {} as never,
      current: {} as never,
      citations: [],
    },
  })
  const snapshot = async () => ({
    drafts: await prisma.generatedElementDraft.findMany({ where: { buildId } }),
    spends: await prisma.elementGenerationSpend.findMany({
      where: { buildId },
    }),
    quota: await prisma.kBGraphQuota.findFirstOrThrow({ where: { ownerId } }),
  })
  const before = await snapshot()
  return { buildId, ctx, runtime, snapshot, before, startManifestArtifact }
}

const readBuild = (id: string) =>
  prisma.elementGenerationBuild.findUniqueOrThrow({ where: { id } })
const publish = (f: Awaited<ReturnType<typeof fixture>>) =>
  publishIncompleteFlashcardGeneration(
    { buildId: f.buildId, acknowledgeIncomplete: true },
    f.ctx
  )

async function changeOwner(buildId: string) {
  otherOwnerId = randomUUID()
  await prisma.user.create({
    data: {
      id: otherOwnerId,
      email: `${otherOwnerId}@example.org`,
      shortname: `other-${otherOwnerId.slice(0, 8)}`,
    },
  })
  await prisma.elementGenerationBuild.update({
    where: { id: buildId },
    data: { ownerId: otherOwnerId },
  })
}

describe('incomplete flashcard publication transitions', () => {
  it('claims once under concurrent requests without changing drafts or spend', async () => {
    const f = await fixture()
    const previousAttempt = randomUUID()
    await prisma.elementGenerationBuild.update({
      where: { id: f.buildId },
      data: {
        providerPublicationDispatchAttemptId: previousAttempt,
        providerPublicationEventId: 'old-event',
        providerPublicationWorkflowRunId: 'old-run',
      },
    })
    const results = await Promise.allSettled([
      claimIncompleteFlashcardPublication(f.buildId, f.ctx),
      claimIncompleteFlashcardPublication(f.buildId, f.ctx),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'CONCURRENT_MODIFICATION' },
    })
    const build = await readBuild(f.buildId)
    expect(build.status).toBe(
      DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE
    )
    expect(build.providerPublicationDispatchAttemptId).not.toBe(previousAttempt)
    expect(build.incompletePublishedById).toBe(ownerId)
    expect(build.incompletePublishedAt).toBeInstanceOf(Date)
    expect(build.providerPublicationDispatchAttemptId).toMatch(
      /^[0-9a-f-]{36}$/
    )
    expect(build.providerPublicationEventId).toBeNull()
    expect(build.providerPublicationWorkflowRunId).toBeNull()
    expect(await f.snapshot()).toEqual(f.before)
  })

  it.each([
    'owner',
    'status',
  ] as const)('rejects a claim with wrong %s', async (mode) => {
    const f = await fixture()
    if (mode === 'owner') await changeOwner(f.buildId)
    else
      await prisma.elementGenerationBuild.update({
        where: { id: f.buildId },
        data: { status: DB.ElementGenerationBuildStatus.COMPLETED },
      })
    const before = await readBuild(f.buildId)
    await expect(
      claimIncompleteFlashcardPublication(f.buildId, f.ctx)
    ).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' })
    expect(await readBuild(f.buildId)).toEqual(before)
    expect(await f.snapshot()).toEqual(f.before)
  })

  it('requires acknowledgement before claiming or dispatching', async () => {
    const f = await fixture()
    const before = await readBuild(f.buildId)
    await expect(
      publishIncompleteFlashcardGeneration(
        { buildId: f.buildId, acknowledgeIncomplete: false },
        f.ctx
      )
    ).rejects.toMatchObject({ code: 'CONFIGURATION_INVALID' })
    expect(await readBuild(f.buildId)).toEqual(before)
    expect(f.runtime.publishIncompleteFlashcards).not.toHaveBeenCalled()
  })

  it.each([
    'none',
    'event',
    'run',
    'token',
    'attempt',
    'status',
    'owner',
  ] as const)('fences definitive dispatch recovery against %s changes', async (mode) => {
    const f = await fixture()
    let resetCount: number | undefined
    let beforeReset: Awaited<ReturnType<typeof readBuild>> | undefined
    const observed = prisma.$extends({
      query: {
        elementGenerationBuild: {
          async updateMany({ args, query }) {
            if (args.data.stage === 'awaiting_incomplete_publication') {
              const data =
                mode === 'event'
                  ? { providerPublicationEventId: 'existing-event' }
                  : mode === 'run'
                    ? { providerPublicationWorkflowRunId: 'existing-run' }
                    : mode === 'token'
                      ? { syncLeaseOwner: 'replacement-token' }
                      : mode === 'attempt'
                        ? { providerPublicationDispatchAttemptId: randomUUID() }
                        : mode === 'status'
                          ? {
                              status: DB.ElementGenerationBuildStatus.COMPLETED,
                            }
                          : null
              if (mode === 'owner') await changeOwner(f.buildId)
              else if (data)
                await prisma.elementGenerationBuild.update({
                  where: { id: f.buildId },
                  data,
                })
              beforeReset = await readBuild(f.buildId)
              const result = await query(args)
              resetCount = result.count
              return result
            }
            return query(args)
          },
        },
      },
    })
    f.ctx.prisma = observed as unknown as ContextWithUser['prisma']
    const result = await publish(f).catch((e) => e)
    expect(resetCount).toBe(mode === 'none' ? 1 : 0)
    const build = await readBuild(f.buildId)
    if (mode === 'none') {
      expect(build).toMatchObject({
        status: DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
        stage: 'awaiting_incomplete_publication',
        providerPublicationDispatchAttemptId: null,
        incompletePublishedById: null,
        incompletePublishedAt: null,
      })
    } else {
      const omitLease = ({
        syncLeaseOwner: _owner,
        syncLeaseUntil: _until,
        updatedAt: _updated,
        ...rest
      }: typeof build) => rest
      expect(omitLease(build)).toEqual(omitLease(beforeReset!))
    }
    if (mode === 'owner')
      expect(result).toMatchObject({
        code: 'FLASHCARD_GENERATION_BUILD_NOT_FOUND',
      })
    expect(build.syncLeaseOwner).toBe(
      mode === 'token' ? 'replacement-token' : null
    )
    expect(f.runtime.publishIncompleteFlashcards).toHaveBeenCalledOnce()
    expect(await f.snapshot()).toEqual(f.before)
  })

  it.each([
    'none',
    'token',
    'attempt',
    'status',
    'owner',
  ] as const)('characterizes correlation and outer failure handling after %s changes', async (mode) => {
    const f = await fixture()
    f.runtime.publishIncompleteFlashcards.mockImplementation(
      async () => ({ eventId: 'new-event' }) as never
    )
    let correlationCount: number | undefined
    let originalAttempt: string | null = null
    f.ctx.prisma = prisma.$extends({
      query: {
        elementGenerationBuild: {
          async updateMany({ args, query }) {
            if (args.data.providerPublicationEventId === 'new-event') {
              originalAttempt = (await readBuild(f.buildId))
                .providerPublicationDispatchAttemptId
              if (mode === 'owner') await changeOwner(f.buildId)
              else if (mode !== 'none')
                await prisma.elementGenerationBuild.update({
                  where: { id: f.buildId },
                  data:
                    mode === 'token'
                      ? { syncLeaseOwner: 'replacement-token' }
                      : mode === 'attempt'
                        ? { providerPublicationDispatchAttemptId: randomUUID() }
                        : { status: DB.ElementGenerationBuildStatus.COMPLETED },
                })
              const result = await query(args)
              correlationCount = result.count
              return result
            }
            return query(args)
          },
        },
      },
    }) as unknown as ContextWithUser['prisma']
    const result = await publish(f).catch((e) => e)
    expect(result).toMatchObject(
      mode === 'owner'
        ? { code: 'FLASHCARD_GENERATION_BUILD_NOT_FOUND' }
        : { id: f.buildId }
    )
    expect(correlationCount).toBe(mode === 'none' ? 1 : 0)
    const build = await readBuild(f.buildId)
    expect(build.status).toBe(
      mode === 'none' || mode === 'token'
        ? DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE
        : DB.ElementGenerationBuildStatus.FAILED
    )
    expect(build.providerPublicationEventId).toBe(
      mode === 'none' ? 'new-event' : null
    )
    expect(build.syncLeaseOwner).toBe(
      mode === 'token' ? 'replacement-token' : null
    )
    if (mode !== 'attempt')
      expect(build.providerPublicationDispatchAttemptId).toBe(originalAttempt)
    if (!['none', 'token'].includes(mode))
      expect(build.errorCode).toBe('CONCURRENT_MODIFICATION')
    expect(await f.snapshot()).toEqual(f.before)
  })

  it.each([
    true,
    false,
  ])('retains the publication attempt after uncertain dispatch, recovered=%s', async (recovered) => {
    const f = await fixture()
    f.runtime.publishIncompleteFlashcards.mockImplementation(async () => {
      throw questionGenerationServiceError(
        'WORKFLOW_DISPATCH_UNCERTAIN',
        'Synthetic uncertainty',
        true
      )
    })
    f.runtime.findRunByFlashcardBuildId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        recovered
          ? ({ runId: 'recovered-run', status: 'RUNNING' } as never)
          : null
      )
    await publish(f)
    const build = await readBuild(f.buildId)
    expect(build.status).toBe(
      DB.ElementGenerationBuildStatus.PUBLISHING_INCOMPLETE
    )
    expect(build.providerPublicationWorkflowRunId).toBe(
      recovered ? 'recovered-run' : null
    )
    expect(build.providerPublicationEventId).toBeNull()
    expect(f.runtime.findRunByFlashcardBuildId).toHaveBeenCalledTimes(3)
    expect(f.runtime.publishIncompleteFlashcards).toHaveBeenCalledOnce()
    expect(f.runtime.findRunByFlashcardBuildId.mock.calls[2]?.[1]).toBe(
      build.providerPublicationDispatchAttemptId
    )
    expect(await f.snapshot()).toEqual(f.before)
  })
})
