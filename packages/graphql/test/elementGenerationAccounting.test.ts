import { randomUUID } from 'node:crypto'
import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  ElementGenerationBuildStatus,
  ElementType,
  KBGraphCostStatus,
  KBGraphQualityTier,
  KBGraphQuotaSpendClass,
} from '@klicker-uzh/prisma/client'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertElementGenerationCostAccounted,
  claimElementGenerationSpend,
  createElementGenerationBuildWithSpend,
  isElementGenerationCostConfigured,
  releaseStaleClaimedElementGenerationSpend,
  releaseUnclaimedElementGenerationSpend,
  reserveFlashcardRetrySpend,
  settleElementGenerationSpend,
} from '../src/services/elementGenerationAccounting.js'
import { reserveKBGraphCost } from '../src/services/knowledgeGraphAccounting.js'

const NOW = new Date('2026-08-15T19:30:00.000Z')
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

const prisma = prismaClient
let ownerId: string
let graphBuildId: string

function buildData({
  buildId = randomUUID(),
  dispatchAttemptId = randomUUID(),
  idempotencyKey,
  elementType = ElementType.SC,
}: {
  buildId?: string
  dispatchAttemptId?: string
  idempotencyKey: string
  elementType?: ElementType
}) {
  return {
    id: buildId,
    ownerId,
    sourceGraphBuildId: graphBuildId,
    elementType,
    idempotencyKey,
    configurationHash: `configuration-${elementType}`,
    configuration: {} as never,
    requestedElementCount: 2,
    providerDispatchAttemptId: dispatchAttemptId,
  }
}

describe('element-generation cost accounting', () => {
  beforeEach(async () => {
    ownerId = randomUUID()
    const kbId = randomUUID()
    graphBuildId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `element-cost-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: { id: kbId, ownerId, name: 'Element accounting test KB' },
    })
    await prisma.kBGraphBuild.create({
      data: {
        id: graphBuildId,
        kbId,
        requestedById: ownerId,
        sourceContentDigest: 'a'.repeat(64),
        graphName: `klickeruzh:kb:${kbId}:${graphBuildId}`,
      },
    })
  })

  afterEach(async () => {
    await prisma.user.delete({ where: { id: ownerId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('requires every dispatch price and the shared graph quota', () => {
    expect(isElementGenerationCostConfigured(costEnv, NOW)).toBe(true)
    expect(
      isElementGenerationCostConfigured(
        {
          ...costEnv,
          KB_ELEMENT_GENERATION_FLASHCARD_RETRY_COST_MINOR_UNITS: '',
        },
        NOW
      )
    ).toBe(false)
  })

  it('fences a nonterminal build that predates cost accounting', () => {
    expect(() =>
      assertElementGenerationCostAccounted({ costAccountingVersion: null })
    ).toThrow(
      'Element-generation build predates the required cost accounting ledger'
    )
  })

  it('serializes idempotent starts and reserves one append-only spend', async () => {
    const idempotencyKey = 'same-start'
    const results = await Promise.all([
      createElementGenerationBuildWithSpend(prisma, {
        ownerId,
        idempotencyKey,
        spendClass: KBGraphQuotaSpendClass.QUESTION_GENERATION,
        data: buildData({ idempotencyKey }),
        env: costEnv,
        now: NOW,
      }),
      createElementGenerationBuildWithSpend(prisma, {
        ownerId,
        idempotencyKey,
        spendClass: KBGraphQuotaSpendClass.QUESTION_GENERATION,
        data: buildData({ idempotencyKey }),
        env: costEnv,
        now: NOW,
      }),
    ])

    expect(results.filter((result) => result.created)).toHaveLength(1)
    expect(new Set(results.map((result) => result.buildId)).size).toBe(1)
    await expect(
      prisma.elementGenerationSpend.findMany({
        where: { buildId: results[0]!.buildId },
      })
    ).resolves.toHaveLength(1)
    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({
      reservedMinorUnits: 40,
      settledMinorUnits: 0,
    })
  })

  it('claims and settles one provider dispatch idempotently', async () => {
    const dispatchAttemptId = randomUUID()
    await createElementGenerationBuildWithSpend(prisma, {
      ownerId,
      idempotencyKey: 'settled-start',
      spendClass: KBGraphQuotaSpendClass.QUESTION_GENERATION,
      data: buildData({
        idempotencyKey: 'settled-start',
        dispatchAttemptId,
      }),
      env: costEnv,
      now: NOW,
    })

    await expect(
      claimElementGenerationSpend(prisma, dispatchAttemptId, NOW)
    ).resolves.toBe(true)
    await expect(
      claimElementGenerationSpend(prisma, dispatchAttemptId, NOW)
    ).resolves.toBe(false)
    await expect(
      Promise.all([
        settleElementGenerationSpend(prisma, dispatchAttemptId, NOW),
        settleElementGenerationSpend(prisma, dispatchAttemptId, NOW),
      ])
    ).resolves.toEqual(expect.arrayContaining([true, false]))
    await expect(
      prisma.elementGenerationSpend.findUniqueOrThrow({
        where: { dispatchAttemptId },
      })
    ).resolves.toMatchObject({
      costStatus: KBGraphCostStatus.SETTLED,
      actualCostMinorUnits: 40,
    })
    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({
      reservedMinorUnits: 0,
      settledMinorUnits: 40,
    })
  })

  it('releases only a provider dispatch that was never claimed', async () => {
    const dispatchAttemptId = randomUUID()
    await createElementGenerationBuildWithSpend(prisma, {
      ownerId,
      idempotencyKey: 'released-start',
      spendClass: KBGraphQuotaSpendClass.QUESTION_GENERATION,
      data: buildData({
        idempotencyKey: 'released-start',
        dispatchAttemptId,
      }),
      env: costEnv,
      now: NOW,
    })

    await expect(
      prisma.$transaction((transaction) =>
        releaseUnclaimedElementGenerationSpend(
          transaction,
          dispatchAttemptId,
          NOW
        )
      )
    ).resolves.toBe(true)
    await expect(
      prisma.$transaction((transaction) =>
        releaseUnclaimedElementGenerationSpend(
          transaction,
          dispatchAttemptId,
          NOW
        )
      )
    ).resolves.toBe(false)
    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({
      reservedMinorUnits: 0,
      settledMinorUnits: 0,
    })
  })

  it('releases a claimed dispatch only after its recovery grace expires', async () => {
    const dispatchAttemptId = randomUUID()
    await createElementGenerationBuildWithSpend(prisma, {
      ownerId,
      idempotencyKey: 'stale-claimed-start',
      spendClass: KBGraphQuotaSpendClass.QUESTION_GENERATION,
      data: buildData({
        idempotencyKey: 'stale-claimed-start',
        dispatchAttemptId,
      }),
      env: costEnv,
      now: NOW,
    })
    await claimElementGenerationSpend(prisma, dispatchAttemptId, NOW)

    await expect(
      releaseStaleClaimedElementGenerationSpend(
        prisma,
        dispatchAttemptId,
        new Date(NOW.getTime() + 14 * 60 * 1000)
      )
    ).resolves.toBe(false)
    await expect(
      releaseStaleClaimedElementGenerationSpend(
        prisma,
        dispatchAttemptId,
        new Date(NOW.getTime() + 16 * 60 * 1000)
      )
    ).resolves.toBe(true)
    await expect(
      prisma.elementGenerationSpend.findUniqueOrThrow({
        where: { dispatchAttemptId },
      })
    ).resolves.toMatchObject({ costStatus: KBGraphCostStatus.RELEASED })
  })

  it('uses the graph-build and element-generation ledger as one quota', async () => {
    await prisma.$transaction((transaction) =>
      reserveKBGraphCost(transaction, {
        ownerId,
        qualityTier: KBGraphQualityTier.STANDARD,
        env: costEnv,
        now: NOW,
      })
    )

    await expect(
      createElementGenerationBuildWithSpend(prisma, {
        ownerId,
        idempotencyKey: 'over-shared-quota',
        spendClass: KBGraphQuotaSpendClass.QUESTION_GENERATION,
        data: buildData({ idempotencyKey: 'over-shared-quota' }),
        env: costEnv,
        now: NOW,
      })
    ).rejects.toMatchObject({
      extensions: { code: 'KB_GRAPH_QUOTA_EXCEEDED' },
    })
  })

  it('records a flashcard retry as an independent dispatch spend', async () => {
    const initialDispatchAttemptId = randomUUID()
    const { buildId } = await createElementGenerationBuildWithSpend(prisma, {
      ownerId,
      idempotencyKey: 'flashcard-start',
      spendClass: KBGraphQuotaSpendClass.FLASHCARD_GENERATION,
      data: buildData({
        idempotencyKey: 'flashcard-start',
        elementType: ElementType.FLASHCARD,
        dispatchAttemptId: initialDispatchAttemptId,
      }),
      env: costEnv,
      now: NOW,
    })
    await claimElementGenerationSpend(prisma, initialDispatchAttemptId, NOW)
    await settleElementGenerationSpend(prisma, initialDispatchAttemptId, NOW)
    await prisma.elementGenerationBuild.update({
      where: { id: buildId },
      data: {
        status: ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
      },
    })

    const retryDispatchAttemptId = randomUUID()
    await expect(
      reserveFlashcardRetrySpend(prisma, {
        buildId,
        ownerId,
        dispatchAttemptId: retryDispatchAttemptId,
        env: costEnv,
        now: NOW,
      })
    ).resolves.toBe(true)
    await expect(
      prisma.elementGenerationSpend.findMany({
        where: { buildId },
        orderBy: { createdAt: 'asc' },
        select: {
          spendClass: true,
          costStatus: true,
          estimatedCostMinorUnits: true,
        },
      })
    ).resolves.toEqual([
      {
        spendClass: KBGraphQuotaSpendClass.FLASHCARD_GENERATION,
        costStatus: KBGraphCostStatus.SETTLED,
        estimatedCostMinorUnits: 30,
      },
      {
        spendClass: KBGraphQuotaSpendClass.FLASHCARD_RETRY,
        costStatus: KBGraphCostStatus.RESERVED,
        estimatedCostMinorUnits: 10,
      },
    ])
  })
})
