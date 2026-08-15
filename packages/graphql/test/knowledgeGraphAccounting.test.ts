import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  KBGraphBuildStatus,
  KBGraphCostStatus,
  KBGraphQualityTier,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  releaseKBGraphCostReservation,
  reserveKBGraphCost,
  settleKBGraphBuildCost,
} from '../src/services/knowledgeGraphAccounting.js'

const NOW = new Date('2026-08-15T19:30:00.000Z')
const SOURCE_CONTENT_DIGEST =
  '9b74c9897bac770ffc029102a200c5de11ba9dbd0e0f28c991eb64b0fb54d96e'

const costEnv = {
  KB_GRAPH_COST_CURRENCY: 'CHF',
  KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '100',
  KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS: '200',
  KB_GRAPH_MAX_COST_MINOR_UNITS: '200',
  KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '200',
  KB_GRAPH_COST_PRICING_VERSION: 'test-v1',
  KB_GRAPH_SEMESTER_KEY: '2026-H2',
}

const prisma = prismaClient
let ownerId: string
let kbId: string

async function createBuild({
  costStatus = KBGraphCostStatus.RESERVED,
  active = true,
  cleanupStartedAt = null,
  cleanedAt = null,
}: {
  costStatus?: KBGraphCostStatus
  active?: boolean
  cleanupStartedAt?: Date | null
  cleanedAt?: Date | null
} = {}) {
  const buildId = randomUUID()
  const runId = `run-${buildId}`
  const graphmlBlobName = `knowledge-graphs/${buildId}.graphml`
  const quota = await prisma.kBGraphQuota.findUniqueOrThrow({
    where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
    select: { id: true },
  })
  const build = await prisma.kBGraphBuild.create({
    data: {
      id: buildId,
      kbId,
      requestedById: ownerId,
      status: KBGraphBuildStatus.PROCESSING,
      qualityTier: KBGraphQualityTier.STANDARD,
      sourceContentDigest: SOURCE_CONTENT_DIGEST,
      graphName: `klickeruzh:kb:${kbId}:${buildId}`,
      graphmlBlobName,
      estimatedCostMinorUnits: 100,
      costCurrency: 'CHF',
      costPricingVersion: 'test-v1',
      costStatus,
      semesterKey: '2026-H2',
      quotaId: quota.id,
      externalOperationId: runId,
      cleanupStartedAt,
      cleanedAt,
    },
  })
  if (active) {
    await prisma.kB.update({
      where: { id: kbId },
      data: { activeGraphBuildId: buildId },
    })
  }
  return { build, runId, graphmlBlobName }
}

function successfulResult({
  buildId,
  runId,
  amountMinorUnits = 60,
  graphmlBlobName,
}: {
  buildId: string
  runId: string
  amountMinorUnits?: number
  graphmlBlobName: string
}) {
  return {
    contract_version: 'klicker-kb-graph/v1',
    result_id: `${buildId}:${runId}`,
    build_id: buildId,
    kb_id: kbId,
    owner_id: ownerId,
    run_id: runId,
    source_content_digest: SOURCE_CONTENT_DIGEST,
    graph_name: `klickeruzh:kb:${kbId}:${buildId}`,
    status: 'SUCCEEDED',
    edge_count: 1,
    failed_document_count: 0,
    graphml_artifact: {
      container_name: `kb-${ownerId}`,
      blob_name: graphmlBlobName,
    },
    metered_cost: {
      currency: 'CHF',
      amount_minor_units: amountMinorUnits,
      components: [
        {
          provider: 'test-provider',
          model: 'test-model',
          amount_minor_units: amountMinorUnits,
          pricing_version: 'test-v1',
          embedding_tokens: 7,
          input_tokens: 11,
          output_tokens: 13,
          request_count: 2,
        },
      ],
      metering_source: 'configured_pricing',
    },
    node_count: 2,
    processed_document_count: 1,
    error_code: null,
  }
}

describe('KB graph cost accounting', () => {
  beforeEach(async () => {
    ownerId = randomUUID()
    kbId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.org`,
        shortname: `kb-graph-${ownerId.slice(0, 8)}`,
      },
    })
    await prisma.kB.create({
      data: {
        id: kbId,
        ownerId,
        name: 'Accounting test KB',
      },
    })
  })

  afterEach(async () => {
    await prisma.user.delete({ where: { id: ownerId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('serializes concurrent reservations against the same semester quota', async () => {
    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        reserveKBGraphCost(tx, {
          ownerId,
          qualityTier: KBGraphQualityTier.STANDARD,
          env: { ...costEnv, KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '150' },
          now: NOW,
        })
      ),
      prisma.$transaction((tx) =>
        reserveKBGraphCost(tx, {
          ownerId,
          qualityTier: KBGraphQualityTier.STANDARD,
          env: { ...costEnv, KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '150' },
          now: NOW,
        })
      ),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1)
    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({
      limitMinorUnits: 150,
      reservedMinorUnits: 100,
      settledMinorUnits: 0,
    })
  })

  it('settles a valid result once and publishes only the validated build', async () => {
    const reservation = await prisma.$transaction((tx) =>
      reserveKBGraphCost(tx, {
        ownerId,
        qualityTier: KBGraphQualityTier.STANDARD,
        env: costEnv,
        now: NOW,
      })
    )
    const { build, runId, graphmlBlobName } = await createBuild()
    expect(reservation.estimatedCostMinorUnits).toBe(100)

    const result = successfulResult({
      buildId: build.id,
      runId,
      graphmlBlobName,
    })
    await expect(
      prisma.$transaction((tx) =>
        settleKBGraphBuildCost(tx, {
          buildId: build.id,
          result,
          finishedAt: NOW,
        })
      )
    ).resolves.toBe('SETTLED')
    await expect(
      prisma.$transaction((tx) =>
        settleKBGraphBuildCost(tx, {
          buildId: build.id,
          result,
          finishedAt: NOW,
        })
      )
    ).resolves.toBe('DUPLICATE')

    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({
      reservedMinorUnits: 0,
      settledMinorUnits: 60,
    })
    await expect(
      prisma.kBGraphBuild.findUniqueOrThrow({ where: { id: build.id } })
    ).resolves.toMatchObject({
      status: KBGraphBuildStatus.SUCCEEDED,
      costStatus: KBGraphCostStatus.SETTLED,
      actualCostMinorUnits: 60,
      actualInputTokens: 11,
      actualOutputTokens: 13,
      actualEmbeddingTokens: 7,
      actualRequestCount: 2,
    })
    await expect(
      prisma.kB.findUniqueOrThrow({ where: { id: kbId } })
    ).resolves.toMatchObject({
      activeGraphBuildId: null,
      publishedGraphBuildId: build.id,
    })
  })

  it('holds invalid results until a valid late success reconciles the reservation', async () => {
    await prisma.$transaction((tx) =>
      reserveKBGraphCost(tx, {
        ownerId,
        qualityTier: KBGraphQualityTier.STANDARD,
        env: costEnv,
        now: NOW,
      })
    )
    const { build, runId, graphmlBlobName } = await createBuild()
    const invalidResult = {
      ...successfulResult({ buildId: build.id, runId, graphmlBlobName }),
      owner_id: randomUUID(),
    }

    await expect(
      prisma.$transaction((tx) =>
        settleKBGraphBuildCost(tx, {
          buildId: build.id,
          result: invalidResult,
          finishedAt: NOW,
        })
      )
    ).resolves.toBe('NEEDS_HUMAN_REVIEW')

    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({
      reservedMinorUnits: 100,
      settledMinorUnits: 0,
    })
    await expect(
      prisma.kBGraphBuild.findUniqueOrThrow({ where: { id: build.id } })
    ).resolves.toMatchObject({
      status: KBGraphBuildStatus.FAILED,
      costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW,
      errorCode: 'KB_GRAPH_RESULT_CONTRACT_INVALID',
    })
    await expect(
      prisma.kB.findUniqueOrThrow({ where: { id: kbId } })
    ).resolves.toMatchObject({ activeGraphBuildId: null })

    await expect(
      prisma.$transaction((tx) => releaseKBGraphCostReservation(tx, build.id))
    ).resolves.toBe(false)

    const lateFailure = {
      ...successfulResult({ buildId: build.id, runId, graphmlBlobName }),
      status: 'FAILED',
      error_code: 'KB_GRAPH_PROVIDER_FAILED',
      graphml_artifact: null,
      metered_cost: null,
    }
    await expect(
      prisma.$transaction((tx) =>
        settleKBGraphBuildCost(tx, {
          buildId: build.id,
          result: lateFailure,
          finishedAt: NOW,
        })
      )
    ).resolves.toBe('NEEDS_HUMAN_REVIEW')
    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({ reservedMinorUnits: 100, settledMinorUnits: 0 })
    await expect(
      prisma.$transaction((tx) =>
        settleKBGraphBuildCost(tx, {
          buildId: build.id,
          result: successfulResult({
            buildId: build.id,
            runId,
            graphmlBlobName,
          }),
          finishedAt: NOW,
        })
      )
    ).resolves.toBe('SETTLED')
    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({ reservedMinorUnits: 0, settledMinorUnits: 60 })
  })

  it('releases a reservation exactly once when dispatch never starts', async () => {
    await prisma.$transaction((tx) =>
      reserveKBGraphCost(tx, {
        ownerId,
        qualityTier: KBGraphQualityTier.STANDARD,
        env: costEnv,
        now: NOW,
      })
    )
    const { build } = await createBuild()

    await expect(
      prisma.$transaction((tx) => releaseKBGraphCostReservation(tx, build.id))
    ).resolves.toBe(true)
    await expect(
      prisma.$transaction((tx) => releaseKBGraphCostReservation(tx, build.id))
    ).resolves.toBe(false)

    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({ reservedMinorUnits: 0, settledMinorUnits: 0 })
    await expect(
      prisma.kBGraphBuild.findUniqueOrThrow({ where: { id: build.id } })
    ).resolves.toMatchObject({ costStatus: KBGraphCostStatus.RELEASED })
  })

  it('does not publish a valid result after cleanup has started', async () => {
    await prisma.$transaction((tx) =>
      reserveKBGraphCost(tx, {
        ownerId,
        qualityTier: KBGraphQualityTier.STANDARD,
        env: costEnv,
        now: NOW,
      })
    )
    const { build, runId, graphmlBlobName } = await createBuild({
      cleanupStartedAt: NOW,
    })

    await expect(
      prisma.$transaction((tx) =>
        settleKBGraphBuildCost(tx, {
          buildId: build.id,
          result: successfulResult({
            buildId: build.id,
            runId,
            graphmlBlobName,
          }),
          finishedAt: NOW,
        })
      )
    ).resolves.toBe('NEEDS_HUMAN_REVIEW')
    await expect(
      prisma.kBGraphBuild.findUniqueOrThrow({ where: { id: build.id } })
    ).resolves.toMatchObject({
      status: KBGraphBuildStatus.FAILED,
      costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW,
      errorCode: 'KB_GRAPH_RESULT_AFTER_CLEANUP',
      actualCostMinorUnits: null,
    })
    await expect(
      prisma.kBGraphQuota.findUniqueOrThrow({
        where: { ownerId_semesterKey: { ownerId, semesterKey: '2026-H2' } },
      })
    ).resolves.toMatchObject({ reservedMinorUnits: 100, settledMinorUnits: 0 })
    await expect(
      prisma.kB.findUniqueOrThrow({ where: { id: kbId } })
    ).resolves.toMatchObject({ publishedGraphBuildId: null })
  })
})
