import { randomUUID } from 'node:crypto'
import {
  createDisposableTestPrismaClient,
  requireDisposableDatabase,
} from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import type { QuestionGenerationConfiguration } from '@klicker-uzh/types'
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
import {
  getQuestionGenerationBuild,
  reviewQuestionGenerationDesign,
  reviewQuestionGenerationPlan,
} from '../src/services/questionGeneration.js'
import { questionGenerationServiceError } from '../src/services/questionGenerationErrors.js'
import type { QuestionGenerationRuntime } from '../src/services/questionGenerationRuntime.js'

vi.mock('../src/services/questionGenerationGraph.js', () => ({
  assertQuestionGenerationPreviewAccess: async () => undefined,
  questionGenerationSourceSnapshot: () => [],
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

function artifactRef(containerName = 'question-results') {
  return {
    containerName,
    blobName: `question-builds/synthetic/${randomUUID()}`,
    sha256: 'a'.repeat(64),
  }
}

let prisma: DB.PrismaClient
let ownerId!: string
let kbId!: string
let graphBuildId!: string
let buildId!: string
const cleanupIds = {
  users: new Set<string>(),
  kbs: new Set<string>(),
  graphs: new Set<string>(),
  builds: new Set<string>(),
}

beforeAll(async () => {
  prisma = await createDisposableTestPrismaClient(process.env.DATABASE_URL!)
  await requireDisposableDatabase(prisma)
})

afterEach(async () => {
  vi.restoreAllMocks()
  if (!prisma) return
  await requireDisposableDatabase(prisma)
  if (cleanupIds.builds.size > 0) {
    await prisma.elementGenerationBuild.deleteMany({
      where: { id: { in: [...cleanupIds.builds] } },
    })
  }
  if (cleanupIds.kbs.size > 0) {
    await prisma.kB.deleteMany({ where: { id: { in: [...cleanupIds.kbs] } } })
  }
  if (cleanupIds.users.size > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: [...cleanupIds.users] } },
    })
  }
  cleanupIds.users.clear()
  cleanupIds.kbs.clear()
  cleanupIds.graphs.clear()
  cleanupIds.builds.clear()
})

afterAll(async () => {
  await prisma?.$disconnect()
})

async function reviewContext(
  runtime: QuestionGenerationRuntime
): Promise<ContextWithUser> {
  return {
    prisma,
    user: { sub: ownerId },
    elementGenerationRuntime: runtime,
  } as unknown as ContextWithUser
}

function noopRuntime(): QuestionGenerationRuntime {
  return {
    questionInputContainer: 'question-inputs',
    questionOutputContainer: 'question-results',
    questionOutputPrefix: 'question-builds',
    uploadCreateOnly: vi.fn(),
    downloadImmutable: vi.fn(),
    downloadVerified: vi.fn(),
    downloadVerifiedStream: vi.fn(),
    start: vi.fn(),
    review: vi.fn(),
    getRun: vi.fn(),
    getRunById: vi.fn(),
    findRunByBuildId: vi.fn(),
    findRunByQuestionReview: vi.fn(),
  } satisfies QuestionGenerationRuntime
}

async function createWaitingBuild(
  gate: DB.ElementGenerationReviewGate,
  warnings: string[] = []
) {
  ownerId = randomUUID()
  kbId = randomUUID()
  graphBuildId = randomUUID()
  buildId = randomUUID()
  cleanupIds.users.add(ownerId)
  cleanupIds.kbs.add(kbId)
  cleanupIds.graphs.add(graphBuildId)
  cleanupIds.builds.add(buildId)
  await prisma.user.create({
    data: {
      id: ownerId,
      email: `${ownerId}@example.org`,
      shortname: `review-${ownerId.slice(0, 8)}`,
    },
  })
  const artifact = artifactRef()
  const summary = {
    title: 'Synthetic design',
    questionCount: 1,
    objectives: [],
    modules: [],
    sources: [],
    slots: [],
    questions: [],
    warnings: warnings.map((code) => ({ code, message: 'Synthetic warning' })),
  }
  await prisma.kB.create({
    data: { id: kbId, ownerId, name: 'Synthetic review KB' },
  })
  await prisma.kBGraphBuild.create({
    data: {
      id: graphBuildId,
      kbId,
      requestedById: ownerId,
      sourceContentDigest: 'a'.repeat(64),
      graphName: `synthetic:${graphBuildId}`,
    },
  })
  await createElementGenerationBuildWithSpend(prisma, {
    ownerId,
    idempotencyKey: buildId,
    spendClass: DB.KBGraphQuotaSpendClass.QUESTION_GENERATION,
    env: costEnv,
    now: new Date('2026-09-10T08:00:00.000Z'),
    data: {
      id: buildId,
      ownerId,
      sourceGraphBuildId: graphBuildId,
      elementType: DB.ElementType.SC,
      idempotencyKey: buildId,
      configurationHash: 'review-matrix',
      configuration: {
        itemType: 'SC',
        language: 'en',
        questionCount: 1,
        objectives: [],
        sourceScopes: [],
        bloomLevels: ['remember'],
        difficultyPreset: 'D1',
        difficultyCounts: { d1: 1, d2: 0, d3: 0, d4: 0, d5: 0 },
      } satisfies QuestionGenerationConfiguration,
      requestedElementCount: 1,
      costAccountingVersion: 1,
      status:
        gate === DB.ElementGenerationReviewGate.DESIGN
          ? DB.ElementGenerationBuildStatus.WAITING_FOR_DESIGN_REVIEW
          : DB.ElementGenerationBuildStatus.WAITING_FOR_PLAN_REVIEW,
      stage:
        gate === DB.ElementGenerationReviewGate.DESIGN
          ? 'design_review'
          : 'plan_review',
      designArtifact:
        gate === DB.ElementGenerationReviewGate.DESIGN
          ? artifact
          : DB.Prisma.DbNull,
      designSummary:
        gate === DB.ElementGenerationReviewGate.DESIGN
          ? summary
          : DB.Prisma.DbNull,
      planArtifact:
        gate === DB.ElementGenerationReviewGate.PLAN
          ? artifact
          : DB.Prisma.DbNull,
      planSummary:
        gate === DB.ElementGenerationReviewGate.PLAN
          ? summary
          : DB.Prisma.DbNull,
    },
  })
  await prisma.generatedElementDraft.create({
    data: {
      buildId,
      sourceElementId: 'synthetic-source',
      order: 0,
      elementType: DB.ElementType.SC,
      original: {
        itemType: 'SC',
        name: 'Synthetic question',
        stem: 'Choose an answer',
        context: null,
        explanation: null,
        choices: [],
        sourceQuestionId: 'synthetic-source',
        bloomLevel: 'remember',
        targetDifficulty: 1,
        predictedDifficulty: null,
        qualityFlags: [],
        citations: [],
      },
      current: {
        itemType: 'SC',
        name: 'Synthetic question',
        stem: 'Choose an answer',
        context: null,
        explanation: null,
        choices: [],
      },
      citations: [],
    },
  })
  return { artifact, summary }
}

async function reviewSnapshot() {
  const [reviews, spends, quota, drafts, build, sourceGraphBuild] =
    await Promise.all([
      prisma.elementGenerationReview.findMany({ where: { buildId } }),
      prisma.elementGenerationSpend.findMany({ where: { buildId } }),
      prisma.kBGraphQuota.findFirstOrThrow({ where: { ownerId } }),
      prisma.generatedElementDraft.findMany({ where: { buildId } }),
      prisma.elementGenerationBuild.findUniqueOrThrow({
        where: { id: buildId },
      }),
      prisma.kBGraphBuild.findUniqueOrThrow({
        where: { id: graphBuildId },
        select: {
          id: true,
          kbId: true,
          graphBundleContainerName: true,
          graphBundleBlobPrefix: true,
          graphBundleStorageName: true,
          graphBundleSha256: true,
          graphSha256: true,
          graphManifestSchemaVersion: true,
          graphManifestArtifact: true,
        },
      }),
    ])
  return { reviews, spends, quota, drafts, build, sourceGraphBuild }
}

function expectReviewInvariants(
  before: Awaited<ReturnType<typeof reviewSnapshot>>,
  after: Awaited<ReturnType<typeof reviewSnapshot>>
) {
  expect(after.spends).toEqual(before.spends)
  expect(after.quota).toEqual(before.quota)
  expect(after.drafts).toEqual(before.drafts)
  expect(after.sourceGraphBuild).toEqual(before.sourceGraphBuild)
  expect(after.build.sourceGraphBuildId).toBe(before.build.sourceGraphBuildId)
}

async function reviewBuild() {
  const [review] = await prisma.elementGenerationReview.findMany({
    where: { buildId },
  })
  expect(review).toBeDefined()
  return review!
}

describe('question review decision lifecycle', () => {
  it.each([
    {
      gate: 'DESIGN',
      decision: 'APPROVE',
      expectedStatus: 'GENERATING_ITEMS',
      expectedStage: 'stems',
    },
    {
      gate: 'DESIGN',
      decision: 'REJECT',
      expectedStatus: 'REJECTED',
      expectedStage: 'rejected',
    },
    {
      gate: 'PLAN',
      decision: 'APPROVE',
      expectedStatus: 'FINALIZING',
      expectedStage: 'finalizing',
    },
    {
      gate: 'PLAN',
      decision: 'REJECT',
      expectedStatus: 'REJECTED',
      expectedStage: 'rejected',
    },
  ] as const)('records a $gate $decision review through the public caller', async ({
    gate,
    decision,
    expectedStatus,
    expectedStage,
  }) => {
    const { artifact } = await createWaitingBuild(
      gate === 'DESIGN'
        ? DB.ElementGenerationReviewGate.DESIGN
        : DB.ElementGenerationReviewGate.PLAN
    )
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    const result = await (gate === 'DESIGN'
      ? reviewQuestionGenerationDesign
      : reviewQuestionGenerationPlan)(
      {
        buildId,
        decision,
        warningsAcknowledged: true,
      },
      await reviewContext(runtime)
    )
    expect(result.status).toBe(DB.ElementGenerationBuildStatus[expectedStatus])
    expect(result.stage).toBe(expectedStage)
    if (decision === 'REJECT') {
      expect(result.completedAt).toBeInstanceOf(Date)
    } else {
      expect(result.completedAt).toBeNull()
    }
    const review = await reviewBuild()
    expect(review.gate).toBe(gate)
    expect(review.decision).toBe(decision)
    expect(review.warningsAcknowledged).toBe(true)
    expect(review.reviewerId).toBe(ownerId)
    expect(review.artifact).toEqual(artifact)
    expect(review.reviewedAt).toBeInstanceOf(Date)
    const after = await reviewSnapshot()
    expectReviewInvariants(before, after)
    expect(runtime.review).toHaveBeenCalledTimes(1)
    expect(runtime.review).toHaveBeenCalledWith(
      expect.objectContaining({
        key:
          gate === 'DESIGN'
            ? 'course-question-blueprint-generation:design-reviewed'
            : 'course-question-blueprint-generation:plan-reviewed',
        payload: expect.objectContaining({
          question_build_id: buildId,
          decision: decision === 'APPROVE' ? 'approve' : 'reject',
          reviewed_by: ownerId,
          acknowledge_warnings: true,
        }),
      }),
      `question-build:${buildId}`,
      review.id
    )
  })

  it('rejects an unacknowledged warning approval without a review row', async () => {
    await createWaitingBuild(DB.ElementGenerationReviewGate.DESIGN, [
      'coverage-gap',
    ])
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    await expect(
      reviewQuestionGenerationDesign(
        { buildId, decision: 'APPROVE', warningsAcknowledged: false },
        await reviewContext(runtime)
      )
    ).rejects.toMatchObject({ code: 'REVIEW_WARNINGS_NOT_ACKNOWLEDGED' })
    const after = await reviewSnapshot()
    expect(after.reviews).toHaveLength(0)
    expect(after.build).toEqual(before.build)
    expectReviewInvariants(before, after)
    expect(runtime.review).not.toHaveBeenCalled()
  })

  it('reuses a repeated decision and rejects a conflicting one', async () => {
    await createWaitingBuild(DB.ElementGenerationReviewGate.DESIGN)
    const first = await reviewQuestionGenerationDesign(
      { buildId, decision: 'APPROVE', warningsAcknowledged: true },
      await reviewContext(noopRuntime())
    )
    const review = await reviewBuild()
    expect(first.status).toBe(DB.ElementGenerationBuildStatus.GENERATING_ITEMS)
    await expect(
      reviewQuestionGenerationDesign(
        { buildId, decision: 'REJECT', warningsAcknowledged: false },
        await reviewContext(noopRuntime())
      )
    ).rejects.toMatchObject({ code: 'REVIEW_CONFLICT' })
    const repeated = await reviewQuestionGenerationDesign(
      { buildId, decision: 'APPROVE', warningsAcknowledged: true },
      await reviewContext(noopRuntime())
    )
    expect(repeated.id).toBe(buildId)
    expect(repeated.status).toBe(
      DB.ElementGenerationBuildStatus.GENERATING_ITEMS
    )
    const [persistedReview] = await prisma.elementGenerationReview.findMany({
      where: { buildId },
    })
    expect(persistedReview!.id).toBe(review.id)
    expect(persistedReview!.decision).toBe(
      DB.ElementGenerationReviewDecision.APPROVE
    )
    expect(persistedReview!.warningsAcknowledged).toBe(true)
  })
})

async function storedReview(ageMilliseconds = 60_000) {
  return prisma.elementGenerationReview.create({
    data: {
      id: randomUUID(),
      buildId,
      gate: 'DESIGN',
      decision: 'APPROVE',
      reviewerId: ownerId,
      warningsAcknowledged: true,
      artifact: artifactRef(),
      reviewedAt: new Date(),
      createdAt: new Date(Date.now() - ageMilliseconds),
    },
  })
}

async function changePredicate(predicate: 'owner' | 'status' | 'token') {
  if (predicate === 'owner') {
    const otherOwnerId = randomUUID()
    cleanupIds.users.add(otherOwnerId)
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
    return
  }
  await prisma.elementGenerationBuild.update({
    where: { id: buildId },
    data:
      predicate === 'status'
        ? { status: 'INCOMPLETE' }
        : {
            syncLeaseOwner: 'replacement-token',
            syncLeaseUntil: new Date(Date.now() + 60_000),
          },
  })
}

function ctxWithClient(ctx: ContextWithUser, client: unknown) {
  return { ...ctx, prisma: client } as ContextWithUser
}

describe('question review concurrent writes', () => {
  it.each([
    'equivalent',
    'conflicting',
  ] as const)('arbitrates %s inserts through the database unique constraint', async (kind) => {
    await createWaitingBuild('DESIGN')
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    let arrivals = 0
    let release!: () => void
    const barrier = new Promise<void>((resolve) => {
      release = resolve
    })
    const timeout = setTimeout(release, 5000)
    const client = prisma.$extends({
      query: {
        elementGenerationReview: {
          async create({ args, query }) {
            arrivals += 1
            if (arrivals === 2) release()
            await barrier
            if (arrivals !== 2)
              throw new Error('Review insert barrier timed out')
            return query(args)
          },
        },
      },
    })
    try {
      const ctx = ctxWithClient(await reviewContext(runtime), client)
      const outcomes = await Promise.allSettled([
        reviewQuestionGenerationDesign(
          { buildId, decision: 'APPROVE', warningsAcknowledged: true },
          ctx
        ),
        reviewQuestionGenerationDesign(
          {
            buildId,
            decision: kind === 'equivalent' ? 'APPROVE' : 'REJECT',
            warningsAcknowledged: true,
          },
          ctx
        ),
      ])
      expect(arrivals).toBe(2)
      expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(
        kind === 'equivalent' ? 2 : 1
      )
      if (kind === 'conflicting')
        expect(outcomes.find((r) => r.status === 'rejected')).toMatchObject({
          reason: { code: 'REVIEW_CONFLICT' },
        })
      const after = await reviewSnapshot()
      expect(after.reviews).toHaveLength(1)
      for (const call of vi.mocked(runtime.review).mock.calls)
        expect(call[2]).toBe(after.reviews[0]!.id)
      expectReviewInvariants(before, after)
    } finally {
      clearTimeout(timeout)
      release()
    }
  })

  it.each([
    'owner',
    'status',
  ] as const)('retains the current unguarded insert after a stale %s read', async (predicate) => {
    await createWaitingBuild('DESIGN')
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    const client = prisma.$extends({
      query: {
        elementGenerationReview: {
          async create({ args, query }) {
            await changePredicate(predicate)
            return query(args)
          },
        },
      },
    })
    const result = reviewQuestionGenerationDesign(
      { buildId, decision: 'APPROVE', warningsAcknowledged: false },
      ctxWithClient(await reviewContext(runtime), client)
    )
    if (predicate === 'owner')
      await expect(result).rejects.toMatchObject({
        code: 'QUESTION_GENERATION_BUILD_NOT_FOUND',
      })
    else expect((await result).status).toBe('INCOMPLETE')
    const after = await reviewSnapshot()
    expect(after.reviews).toHaveLength(1)
    expect(after.reviews[0]).toMatchObject({
      reviewerId: ownerId,
      warningsAcknowledged: true,
    })
    expect(runtime.review).not.toHaveBeenCalled()
    expectReviewInvariants(before, after)
  })

  it.each([
    ['owner', 'direct'],
    ['status', 'direct'],
    ['token', 'direct'],
    ['owner', 'poll'],
    ['status', 'poll'],
    ['token', 'poll'],
  ] as const)('preserves stale %s advance semantics for %s callers', async (predicate, caller) => {
    await createWaitingBuild('DESIGN')
    if (caller === 'poll') await storedReview()
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    vi.mocked(runtime.findRunByQuestionReview).mockImplementation(async () => {
      await changePredicate(predicate)
      return { runId: 'synthetic-recovered-run', status: 'RUNNING' }
    })
    const ctx = await reviewContext(runtime)
    const result =
      caller === 'direct'
        ? reviewQuestionGenerationDesign(
            { buildId, decision: 'APPROVE', warningsAcknowledged: true },
            ctx
          )
        : getQuestionGenerationBuild(buildId, ctx)
    if (caller === 'direct')
      await expect(result).rejects.toMatchObject({
        code: 'CONCURRENT_MODIFICATION',
      })
    else if (predicate === 'owner')
      await expect(result).rejects.toMatchObject({
        code: 'QUESTION_GENERATION_BUILD_NOT_FOUND',
      })
    else await result
    const after = await reviewSnapshot()
    expect(after.build.status).toBe(
      caller === 'poll' && predicate !== 'token'
        ? 'FAILED'
        : predicate === 'status'
          ? 'INCOMPLETE'
          : 'WAITING_FOR_DESIGN_REVIEW'
    )
    expect(after.build.errorCode).toBe(
      caller === 'poll' && predicate !== 'token'
        ? 'CONCURRENT_MODIFICATION'
        : null
    )
    expect(after.build.syncLeaseOwner).toBe(
      predicate === 'token' ? 'replacement-token' : null
    )
    expect(runtime.review).not.toHaveBeenCalled()
    expectReviewInvariants(before, after)
  })

  it.each([
    'owner',
    'status',
    'token',
  ] as const)('ignores a stale %s recovered failure and preserves replacement leases', async (predicate) => {
    await createWaitingBuild('DESIGN')
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    vi.mocked(runtime.findRunByQuestionReview).mockImplementation(async () => {
      await changePredicate(predicate)
      return { runId: 'synthetic-failure', status: 'FAILED' }
    })
    const result = reviewQuestionGenerationDesign(
      { buildId, decision: 'APPROVE', warningsAcknowledged: true },
      await reviewContext(runtime)
    )
    if (predicate === 'owner')
      await expect(result).rejects.toMatchObject({
        code: 'QUESTION_GENERATION_BUILD_NOT_FOUND',
      })
    else await result
    const after = await reviewSnapshot()
    expect(after.build.status).toBe(
      predicate === 'status' ? 'INCOMPLETE' : 'WAITING_FOR_DESIGN_REVIEW'
    )
    expect(after.build.errorCode).toBeNull()
    expect(after.build.syncLeaseOwner).toBe(
      predicate === 'token' ? 'replacement-token' : null
    )
    expectReviewInvariants(before, after)
  })
})

describe('question review dispatch recovery', () => {
  it.each([
    'FAILED',
    'CANCELLED',
    'RUNNING',
  ] as const)('uses a recovered %s run and retained review identity without redispatch', async (status) => {
    await createWaitingBuild('DESIGN')
    const review = await storedReview()
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    vi.mocked(runtime.findRunByQuestionReview).mockResolvedValue({
      runId: 'synthetic-recovered',
      status,
    })
    const result = await getQuestionGenerationBuild(
      buildId,
      await reviewContext(runtime)
    )
    expect(result.status).toBe(
      status === 'RUNNING' ? 'GENERATING_ITEMS' : 'FAILED'
    )
    expect(result.errorCode).toBe(
      status === 'RUNNING' ? null : `WORKFLOW_${status}`
    )
    if (status !== 'RUNNING') {
      expect(result.completedAt).toBeInstanceOf(Date)
      expect(result.errorRetryable).toBe(false)
    }
    expect(runtime.review).not.toHaveBeenCalled()
    expect(runtime.findRunByQuestionReview).toHaveBeenCalledWith(
      buildId,
      review.id,
      review.createdAt
    )
    expectReviewInvariants(before, await reviewSnapshot())
  })

  it.each([
    'fresh',
    'expired',
  ] as const)('respects the recovery window for a %s stored decision', async (age) => {
    await createWaitingBuild('DESIGN')
    const review = await storedReview(age === 'fresh' ? 0 : 60_000)
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    const result = await reviewQuestionGenerationDesign(
      { buildId, decision: 'APPROVE', warningsAcknowledged: true },
      await reviewContext(runtime)
    )
    expect(result.status).toBe(
      age === 'fresh' ? 'WAITING_FOR_DESIGN_REVIEW' : 'GENERATING_ITEMS'
    )
    expect(runtime.review).toHaveBeenCalledTimes(age === 'fresh' ? 0 : 1)
    if (age === 'expired')
      expect(vi.mocked(runtime.review).mock.calls[0]![2]).toBe(review.id)
    expectReviewInvariants(before, await reviewSnapshot())
  })

  it.each([
    true,
    false,
  ])('handles uncertain dispatch with recovered=%s', async (recovered) => {
    await createWaitingBuild('DESIGN')
    const before = await reviewSnapshot()
    const runtime = noopRuntime()
    const error = questionGenerationServiceError(
      'WORKFLOW_DISPATCH_UNCERTAIN',
      'synthetic uncertainty',
      true
    )
    vi.mocked(runtime.review).mockRejectedValue(error)
    vi.mocked(runtime.findRunByQuestionReview)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        recovered ? { runId: 'synthetic-recovered', status: 'RUNNING' } : null
      )
    const result = reviewQuestionGenerationDesign(
      { buildId, decision: 'APPROVE', warningsAcknowledged: true },
      await reviewContext(runtime)
    )
    if (recovered) expect((await result).status).toBe('GENERATING_ITEMS')
    else await expect(result).rejects.toBe(error)
    const after = await reviewSnapshot()
    expect(after.reviews).toHaveLength(1)
    expect(after.build.syncLeaseOwner).toBeNull()
    expect(after.build.status).toBe(
      recovered ? 'GENERATING_ITEMS' : 'WAITING_FOR_DESIGN_REVIEW'
    )
    expectReviewInvariants(before, after)
  })
})
