import { computeKBContentDigest } from '@klicker-uzh/knowledge-graph'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import { randomUUID } from 'node:crypto'
import {
  KB_GRAPH_DATABASE_INT_MAX,
  validateKbGraphTerminalResult,
  type KbGraphTerminalResult,
} from './kbGraphContract.js'
import {
  getKBGraphCostConfiguration,
  getKBGraphEstimate,
  requireKBGraphCostConfiguration,
} from './knowledgeGraphCost.js'

export type KBGraphCostReservation = {
  quotaId: string
  semesterKey: string
  currency: string
  pricingVersion: string
  estimatedCostMinorUnits: number
  maxCostMinorUnits: number
}

type KBGraphCostTransaction = DB.Prisma.TransactionClient

const RESERVATION_HOLD_STATUSES = [DB.KBGraphCostStatus.RESERVED] as const
const SETTLEMENT_HOLD_STATUSES = [
  DB.KBGraphCostStatus.RESERVED,
  DB.KBGraphCostStatus.NEEDS_HUMAN_REVIEW,
] as const

async function lockQuota(
  prisma: KBGraphCostTransaction,
  quotaId: string
): Promise<void> {
  await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."KBGraphQuota"
    WHERE "id" = CAST(${quotaId} AS UUID)
    FOR UPDATE
  `
}

export async function reserveKBGraphCost(
  prisma: KBGraphCostTransaction,
  {
    ownerId,
    qualityTier,
    env = process.env,
    now = new Date(),
  }: {
    ownerId: string
    qualityTier: DB.KBGraphQualityTier
    env?: NodeJS.ProcessEnv
    now?: Date
  }
): Promise<KBGraphCostReservation> {
  const config = requireKBGraphCostConfiguration(env, now)
  const estimatedCostMinorUnits = getKBGraphEstimate(qualityTier, config)
  if (estimatedCostMinorUnits === null) {
    throw new GraphQLError('KB graph cost estimate is not configured', {
      extensions: { code: 'KB_GRAPH_COST_CONFIGURATION_MISSING' },
    })
  }

  const candidateQuotaId = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "public"."KBGraphQuota"
      ("id", "ownerId", "semesterKey", "currency", "limitMinorUnits", "updatedAt")
    VALUES
      (CAST(${candidateQuotaId} AS UUID), CAST(${ownerId} AS UUID),
       ${config.semesterKey}, ${config.currency},
       ${config.semesterQuotaMinorUnits}, ${now})
    ON CONFLICT ("ownerId", "semesterKey") DO NOTHING
  `
  const quota = await prisma.kBGraphQuota.findUniqueOrThrow({
    where: {
      ownerId_semesterKey: {
        ownerId,
        semesterKey: config.semesterKey,
      },
    },
    select: { id: true },
  })
  await lockQuota(prisma, quota.id)

  const lockedQuota = await prisma.kBGraphQuota.findUniqueOrThrow({
    where: { id: quota.id },
    select: {
      currency: true,
      limitMinorUnits: true,
      reservedMinorUnits: true,
      settledMinorUnits: true,
    },
  })
  if (
    lockedQuota.currency !== config.currency ||
    lockedQuota.limitMinorUnits !== config.semesterQuotaMinorUnits
  ) {
    throw new GraphQLError(
      'KB graph quota configuration changed mid-semester',
      {
        extensions: { code: 'KB_GRAPH_QUOTA_CONFIGURATION_CHANGED' },
      }
    )
  }

  const usedMinorUnits =
    lockedQuota.reservedMinorUnits + lockedQuota.settledMinorUnits
  if (usedMinorUnits + estimatedCostMinorUnits > lockedQuota.limitMinorUnits) {
    throw new GraphQLError('KB graph semester quota is insufficient', {
      extensions: {
        code: 'KB_GRAPH_QUOTA_EXCEEDED',
        remainingMinorUnits: Math.max(
          0,
          lockedQuota.limitMinorUnits - usedMinorUnits
        ),
      },
    })
  }

  await prisma.kBGraphQuota.update({
    where: { id: quota.id },
    data: { reservedMinorUnits: { increment: estimatedCostMinorUnits } },
  })

  return {
    quotaId: quota.id,
    semesterKey: config.semesterKey,
    currency: config.currency,
    pricingVersion: config.pricingVersion,
    estimatedCostMinorUnits,
    maxCostMinorUnits: config.maxCostMinorUnits,
  }
}

export async function releaseKBGraphCostReservation(
  prisma: KBGraphCostTransaction,
  buildId: string
): Promise<boolean> {
  const build = await prisma.kBGraphBuild.findUnique({
    where: { id: buildId },
    select: {
      quotaId: true,
      estimatedCostMinorUnits: true,
      costStatus: true,
    },
  })
  if (
    !build ||
    !RESERVATION_HOLD_STATUSES.includes(
      build.costStatus as (typeof RESERVATION_HOLD_STATUSES)[number]
    ) ||
    build.estimatedCostMinorUnits === null
  ) {
    return false
  }

  if (build.quotaId) {
    await lockQuota(prisma, build.quotaId)
  }
  const updated = await prisma.kBGraphBuild.updateMany({
    where: {
      id: buildId,
      costStatus: { in: [...RESERVATION_HOLD_STATUSES] },
    },
    data: { costStatus: DB.KBGraphCostStatus.RELEASED },
  })
  if (updated.count !== 1) return false

  if (build.quotaId) {
    const quotaUpdated = await prisma.kBGraphQuota.updateMany({
      where: {
        id: build.quotaId,
        reservedMinorUnits: { gte: build.estimatedCostMinorUnits },
      },
      data: {
        reservedMinorUnits: { decrement: build.estimatedCostMinorUnits },
      },
    })
    if (quotaUpdated.count !== 1) {
      throw new Error('KB graph quota reservation could not be released')
    }
  }
  return true
}

export type KBGraphCostSettlementOutcome =
  | 'SETTLED'
  | 'RELEASED'
  | 'NEEDS_HUMAN_REVIEW'
  | 'DUPLICATE'

type KBGraphCostBuild = {
  id: string
  kbId: string
  externalOperationId: string | null
  sourceContentDigest: string
  graphName: string
  graphmlBlobName: string | null
  createdAt: Date
  estimatedCostMinorUnits: number | null
  costCurrency: string | null
  costStatus: DB.KBGraphCostStatus | null
  quotaId: string | null
  status: DB.KBGraphBuildStatus
  errorCode: string | null
  cleanupStartedAt: Date | null
  cleanedAt: Date | null
  kb: {
    ownerId: string
    activeGraphBuildId: string | null
    deletedAt: Date | null
  }
}

async function markCostNeedsHumanReview(
  prisma: KBGraphCostTransaction,
  build: KBGraphCostBuild,
  message: string,
  errorCode: string,
  finishedAt: Date
): Promise<KBGraphCostSettlementOutcome> {
  // KB before quota: every other path that touches both rows takes them in this
  // order, and reversing it here would let two settlements deadlock.
  await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."KB"
    WHERE "id" = CAST(${build.kbId} AS UUID)
    FOR UPDATE
  `
  if (build.quotaId) await lockQuota(prisma, build.quotaId)
  const updated = await prisma.kBGraphBuild.updateMany({
    where: {
      id: build.id,
      costStatus: { in: [...RESERVATION_HOLD_STATUSES] },
    },
    data: {
      status: DB.KBGraphBuildStatus.FAILED,
      statusMessage: message,
      errorCode,
      costStatus: DB.KBGraphCostStatus.NEEDS_HUMAN_REVIEW,
      finishedAt,
    },
  })
  if (updated.count === 1) {
    await prisma.kB.updateMany({
      where: { id: build.kbId, activeGraphBuildId: build.id },
      data: { activeGraphBuildId: null },
    })
    return 'NEEDS_HUMAN_REVIEW'
  }
  return 'DUPLICATE'
}

function terminalResultError(result: KbGraphTerminalResult): string {
  return (
    result.error_code ??
    `KB graph provider returned terminal status ${result.status}`
  )
}

type KBGraphLateSuccessResolution =
  | { eligible: true }
  | {
      eligible: false
      status: DB.KBGraphBuildStatus
      statusMessage: string
      errorCode: string
    }

async function reconcileLateKBGraphSuccess(
  prisma: KBGraphCostTransaction,
  build: KBGraphCostBuild
): Promise<KBGraphLateSuccessResolution> {
  const lockedKb = await prisma.$queryRaw<
    Array<{
      id: string
      activeGraphBuildId: string | null
      deletedAt: Date | null
    }>
  >`
    SELECT "id", "activeGraphBuildId", "deletedAt"
    FROM "public"."KB"
    WHERE "id" = CAST(${build.kbId} AS UUID)
    FOR UPDATE
  `
  const currentKb = lockedKb[0]
  if (
    lockedKb.length !== 1 ||
    !currentKb ||
    currentKb.deletedAt !== null ||
    currentKb.activeGraphBuildId !== null
  ) {
    return {
      eligible: false,
      status: DB.KBGraphBuildStatus.SUPERSEDED,
      statusMessage: 'A newer KB graph build replaced this timed-out build.',
      errorCode: 'KB_GRAPH_LATE_SUCCESS_SUPERSEDED',
    }
  }

  const newerBuild = await prisma.kBGraphBuild.findFirst({
    where: { kbId: build.kbId, createdAt: { gt: build.createdAt } },
    select: { id: true },
  })
  if (newerBuild) {
    return {
      eligible: false,
      status: DB.KBGraphBuildStatus.SUPERSEDED,
      statusMessage: 'A newer KB graph build replaced this timed-out build.',
      errorCode: 'KB_GRAPH_LATE_SUCCESS_SUPERSEDED',
    }
  }

  // Resource refreshes lock their resource row. Lock the serving set after the
  // KB row so the digest cannot change between the eligibility check and
  // settlement claim.
  await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT resource."id"
    FROM "public"."KBResource" AS resource
    WHERE resource."kbId" = CAST(${build.kbId} AS UUID)
      AND resource."deletedAt" IS NULL
    ORDER BY resource."id" ASC
    FOR UPDATE OF resource
  `
  const currentDigest = await computeKBContentDigest(prisma, build.kbId)
  if (currentDigest !== build.sourceContentDigest) {
    return {
      eligible: false,
      status: DB.KBGraphBuildStatus.FAILED,
      statusMessage: 'The KB changed before the timed-out build completed.',
      errorCode: 'KB_GRAPH_LATE_SUCCESS_STALE',
    }
  }

  return { eligible: true }
}

export async function settleKBGraphBuildCost(
  prisma: KBGraphCostTransaction,
  {
    buildId,
    result: rawResult,
    finishedAt = new Date(),
    allowLateSuccess = false,
  }: {
    buildId: string
    result: unknown
    finishedAt?: Date
    allowLateSuccess?: boolean
  }
): Promise<KBGraphCostSettlementOutcome> {
  const build = await prisma.kBGraphBuild.findUnique({
    where: { id: buildId },
    select: {
      id: true,
      kbId: true,
      externalOperationId: true,
      sourceContentDigest: true,
      graphName: true,
      graphmlBlobName: true,
      createdAt: true,
      estimatedCostMinorUnits: true,
      costCurrency: true,
      costStatus: true,
      quotaId: true,
      status: true,
      errorCode: true,
      cleanupStartedAt: true,
      cleanedAt: true,
      kb: {
        select: {
          ownerId: true,
          activeGraphBuildId: true,
          deletedAt: true,
        },
      },
    },
  })
  if (!build) {
    throw new GraphQLError('KB graph build not found', {
      extensions: { code: 'KB_GRAPH_BUILD_NOT_FOUND' },
    })
  }
  if (
    !SETTLEMENT_HOLD_STATUSES.includes(
      build.costStatus as (typeof SETTLEMENT_HOLD_STATUSES)[number]
    )
  ) {
    return 'DUPLICATE'
  }
  if (
    build.estimatedCostMinorUnits === null ||
    build.costCurrency === null ||
    build.externalOperationId === null ||
    build.quotaId === null
  ) {
    return markCostNeedsHumanReview(
      prisma,
      build,
      'The KB graph result could not be matched to a complete reservation.',
      'KB_GRAPH_RESERVATION_INCOMPLETE',
      finishedAt
    )
  }

  const expectedResultId = `${build.id}:${build.externalOperationId}`
  const validation = validateKbGraphTerminalResult(rawResult, {
    buildId: build.id,
    kbId: build.kbId,
    ownerId: build.kb.ownerId,
    resultId: expectedResultId,
    runId: build.externalOperationId,
    estimatedMinorUnits: build.estimatedCostMinorUnits,
  })
  if (!validation.ok) {
    return markCostNeedsHumanReview(
      prisma,
      build,
      'The KB graph provider result failed contract validation.',
      'KB_GRAPH_RESULT_CONTRACT_INVALID',
      finishedAt
    )
  }

  const result = validation.result
  if (
    result.source_content_digest !== build.sourceContentDigest ||
    result.graph_name !== build.graphName ||
    (result.graphml_artifact !== null &&
      (result.graphml_artifact.blob_name !== build.graphmlBlobName ||
        result.graphml_artifact.container_name !== `kb-${build.kb.ownerId}`))
  ) {
    return markCostNeedsHumanReview(
      prisma,
      build,
      'The KB graph provider result did not match the pinned build identity.',
      'KB_GRAPH_RESULT_IDENTITY_INVALID',
      finishedAt
    )
  }

  if (
    result.status === 'SUCCEEDED' &&
    (build.cleanupStartedAt !== null || build.cleanedAt !== null)
  ) {
    if (build.costStatus === DB.KBGraphCostStatus.NEEDS_HUMAN_REVIEW) {
      return 'NEEDS_HUMAN_REVIEW'
    }
    return markCostNeedsHumanReview(
      prisma,
      build,
      'A successful KB graph result arrived after artifact cleanup started.',
      'KB_GRAPH_RESULT_AFTER_CLEANUP',
      finishedAt
    )
  }

  if (result.metered_cost !== null) {
    if (result.metered_cost.currency !== build.costCurrency) {
      return markCostNeedsHumanReview(
        prisma,
        build,
        'The KB graph result currency did not match its reservation.',
        'KB_GRAPH_RESULT_CURRENCY_MISMATCH',
        finishedAt
      )
    }

    const usage = {
      inputTokens: 0,
      outputTokens: 0,
      embeddingTokens: 0,
      requestCount: 0,
    }
    for (const component of result.metered_cost.components) {
      if (
        usage.inputTokens >
          KB_GRAPH_DATABASE_INT_MAX - component.input_tokens ||
        usage.outputTokens >
          KB_GRAPH_DATABASE_INT_MAX - component.output_tokens ||
        usage.embeddingTokens >
          KB_GRAPH_DATABASE_INT_MAX - component.embedding_tokens ||
        usage.requestCount > KB_GRAPH_DATABASE_INT_MAX - component.request_count
      ) {
        return markCostNeedsHumanReview(
          prisma,
          build,
          'The KB graph result metering exceeded the database integer range.',
          'KB_GRAPH_RESULT_METERING_OVERFLOW',
          finishedAt
        )
      }
      usage.inputTokens += component.input_tokens
      usage.outputTokens += component.output_tokens
      usage.embeddingTokens += component.embedding_tokens
      usage.requestCount += component.request_count
    }

    const lateSuccess =
      allowLateSuccess &&
      result.status === 'SUCCEEDED' &&
      build.status === DB.KBGraphBuildStatus.FAILED &&
      build.errorCode === 'KB_GRAPH_TIMEOUT'
        ? await reconcileLateKBGraphSuccess(prisma, build)
        : null
    const succeeded = result.status === 'SUCCEEDED'
    const lateRejection = lateSuccess?.eligible === false ? lateSuccess : null
    let publishSuccess =
      succeeded &&
      lateRejection === null &&
      (build.kb.activeGraphBuildId === build.id ||
        lateSuccess?.eligible === true)
    const settledStatus = publishSuccess
      ? DB.KBGraphBuildStatus.SUCCEEDED
      : (lateRejection?.status ??
        (succeeded
          ? DB.KBGraphBuildStatus.SUCCEEDED
          : DB.KBGraphBuildStatus.FAILED))
    const settledStatusMessage = publishSuccess
      ? null
      : (lateRejection?.statusMessage ??
        (succeeded ? null : terminalResultError(result)))
    const settledErrorCode = publishSuccess
      ? null
      : (lateRejection?.errorCode ??
        (succeeded ? null : (result.error_code ?? `KB_GRAPH_${result.status}`)))
    await lockQuota(prisma, build.quotaId!)
    const updated = await prisma.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        costStatus: { in: [...SETTLEMENT_HOLD_STATUSES] },
        ...(succeeded ? { cleanupStartedAt: null, cleanedAt: null } : {}),
      },
      data: {
        status: settledStatus,
        statusMessage: settledStatusMessage,
        errorCode: settledErrorCode,
        actualCostMinorUnits: result.metered_cost.amount_minor_units,
        actualInputTokens: usage.inputTokens,
        actualOutputTokens: usage.outputTokens,
        actualEmbeddingTokens: usage.embeddingTokens,
        actualRequestCount: usage.requestCount,
        costStatus: DB.KBGraphCostStatus.SETTLED,
        meteredCost: result.metered_cost,
        finishedAt,
      },
    })
    if (updated.count !== 1) {
      const current = await prisma.kBGraphBuild.findUnique({
        where: { id: build.id },
        select: { cleanupStartedAt: true, cleanedAt: true },
      })
      return current?.cleanupStartedAt || current?.cleanedAt
        ? 'NEEDS_HUMAN_REVIEW'
        : 'DUPLICATE'
    }

    const quotaUpdated = await prisma.kBGraphQuota.updateMany({
      where: {
        id: build.quotaId!,
        reservedMinorUnits: { gte: build.estimatedCostMinorUnits },
      },
      data: {
        reservedMinorUnits: { decrement: build.estimatedCostMinorUnits },
        settledMinorUnits: {
          increment: result.metered_cost.amount_minor_units,
        },
      },
    })
    if (quotaUpdated.count !== 1) {
      throw new Error('KB graph quota reservation could not be settled')
    }
    if (publishSuccess && lateSuccess?.eligible === true) {
      const claimed = await prisma.kB.updateMany({
        where: {
          id: build.kbId,
          deletedAt: null,
          activeGraphBuildId: null,
        },
        data: { activeGraphBuildId: build.id },
      })
      if (claimed.count !== 1) {
        publishSuccess = false
        const superseded = await prisma.kBGraphBuild.updateMany({
          where: {
            id: build.id,
            costStatus: DB.KBGraphCostStatus.SETTLED,
            status: DB.KBGraphBuildStatus.SUCCEEDED,
          },
          data: {
            status: DB.KBGraphBuildStatus.SUPERSEDED,
            statusMessage:
              'A newer KB graph build replaced this timed-out build.',
            errorCode: 'KB_GRAPH_LATE_SUCCESS_SUPERSEDED',
          },
        })
        if (superseded.count !== 1) {
          throw new Error(
            'KB graph late success could not be marked as superseded'
          )
        }
      }
    }
    if (publishSuccess) {
      const published = await prisma.kB.updateMany({
        where: {
          id: build.kbId,
          deletedAt: null,
          activeGraphBuildId: build.id,
        },
        data: {
          activeGraphBuildId: null,
          publishedGraphBuildId: build.id,
        },
      })
      if (published.count !== 1) {
        throw new Error('KB graph build changed while accepting late success')
      }
    } else {
      await prisma.kB.updateMany({
        where: { id: build.kbId, activeGraphBuildId: build.id },
        data: { activeGraphBuildId: null },
      })
    }
    return 'SETTLED'
  }

  if (result.status === 'SUCCEEDED') {
    return markCostNeedsHumanReview(
      prisma,
      build,
      'A successful KB graph result did not include metering.',
      'KB_GRAPH_RESULT_METERING_MISSING',
      finishedAt
    )
  }

  if (build.costStatus === DB.KBGraphCostStatus.NEEDS_HUMAN_REVIEW) {
    return 'NEEDS_HUMAN_REVIEW'
  }
  if (!(await releaseKBGraphCostReservation(prisma, build.id))) {
    return 'DUPLICATE'
  }
  await prisma.kBGraphBuild.updateMany({
    where: {
      id: build.id,
      costStatus: DB.KBGraphCostStatus.RELEASED,
      status: {
        in: [DB.KBGraphBuildStatus.QUEUED, DB.KBGraphBuildStatus.PROCESSING],
      },
    },
    data: {
      status: DB.KBGraphBuildStatus.FAILED,
      statusMessage: terminalResultError(result),
      errorCode: result.error_code ?? `KB_GRAPH_${result.status}`,
      finishedAt,
    },
  })
  await prisma.kB.updateMany({
    where: { id: build.kbId, activeGraphBuildId: build.id },
    data: { activeGraphBuildId: null },
  })
  return 'RELEASED'
}

export type KBGraphQuotaSummary = {
  currency: string
  limitMinorUnits: number
  reservedMinorUnits: number
  settledMinorUnits: number
}

export function getKBGraphRemainingQuota(
  quota: KBGraphQuotaSummary | null,
  config: ReturnType<typeof getKBGraphCostConfiguration>
): number | null {
  if (quota) {
    return (
      quota.limitMinorUnits - quota.reservedMinorUnits - quota.settledMinorUnits
    )
  }
  if (config.semesterQuotaMinorUnits === null) return null
  return config.semesterQuotaMinorUnits
}
