import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import { KB_GRAPH_DATABASE_INT_MAX } from './kbGraphContract.js'
import {
  ensureLockedKBGraphQuota,
  lockKBGraphQuota,
  reserveKBGraphQuotaAmount,
} from './kbGraphQuota.js'
import { requireKBGraphCostConfiguration } from './knowledgeGraphCost.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'

type Transaction = DB.Prisma.TransactionClient
type SpendClass =
  | typeof DB.KBGraphQuotaSpendClass.QUESTION_GENERATION
  | typeof DB.KBGraphQuotaSpendClass.FLASHCARD_GENERATION
  | typeof DB.KBGraphQuotaSpendClass.FLASHCARD_RETRY

const COST_ENV_BY_SPEND_CLASS: Record<SpendClass, string> = {
  QUESTION_GENERATION: 'KB_ELEMENT_GENERATION_QUESTION_COST_MINOR_UNITS',
  FLASHCARD_GENERATION: 'KB_ELEMENT_GENERATION_FLASHCARD_COST_MINOR_UNITS',
  FLASHCARD_RETRY: 'KB_ELEMENT_GENERATION_FLASHCARD_RETRY_COST_MINOR_UNITS',
}

const PRICING_VERSION_ENV = 'KB_ELEMENT_GENERATION_COST_PRICING_VERSION'
const PRICING_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
export const ELEMENT_GENERATION_DISPATCH_CLAIM_GRACE_MS = 15 * 60 * 1000

type ElementGenerationCostConfiguration = {
  amountMinorUnits: number
  currency: string
  pricingVersion: string
  semesterKey: string
  semesterQuotaMinorUnits: number
}

function configurationError(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'ELEMENT_GENERATION_COST_CONFIGURATION_MISSING' },
  })
}

function requirePositiveMinorUnits(
  env: NodeJS.ProcessEnv,
  name: string
): number {
  const raw = env[name]?.trim()
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    throw configurationError(`${name} must be a positive integer`)
  }
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value > KB_GRAPH_DATABASE_INT_MAX) {
    throw configurationError(`${name} is outside the supported range`)
  }
  return value
}

function requireElementGenerationCostConfiguration(
  spendClass: SpendClass,
  env: NodeJS.ProcessEnv,
  now: Date
): ElementGenerationCostConfiguration {
  let graphCost
  try {
    graphCost = requireKBGraphCostConfiguration(env, now)
  } catch {
    throw configurationError(
      'The shared KB graph semester quota is not completely configured'
    )
  }
  const pricingVersion = env[PRICING_VERSION_ENV]?.trim()
  if (!pricingVersion || !PRICING_VERSION_PATTERN.test(pricingVersion)) {
    throw configurationError(`${PRICING_VERSION_ENV} is invalid`)
  }
  return {
    amountMinorUnits: requirePositiveMinorUnits(
      env,
      COST_ENV_BY_SPEND_CLASS[spendClass]
    ),
    currency: graphCost.currency,
    pricingVersion,
    semesterKey: graphCost.semesterKey,
    semesterQuotaMinorUnits: graphCost.semesterQuotaMinorUnits,
  }
}

export function isElementGenerationCostConfigured(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date()
): boolean {
  try {
    for (const spendClass of [
      DB.KBGraphQuotaSpendClass.QUESTION_GENERATION,
      DB.KBGraphQuotaSpendClass.FLASHCARD_GENERATION,
      DB.KBGraphQuotaSpendClass.FLASHCARD_RETRY,
    ] as const) {
      requireElementGenerationCostConfiguration(spendClass, env, now)
    }
    return true
  } catch {
    return false
  }
}

export function assertElementGenerationCostAccounted(
  build: Pick<DB.ElementGenerationBuild, 'costAccountingVersion'>
): void {
  if (build.costAccountingVersion !== 1) {
    throw questionGenerationServiceError(
      'QUESTION_GENERATION_UNAVAILABLE',
      'Element-generation build predates the required cost accounting ledger'
    )
  }
}

async function createSpend(
  prisma: Transaction,
  {
    buildId,
    quotaId,
    dispatchAttemptId,
    spendClass,
    config,
  }: {
    buildId: string
    quotaId: string
    dispatchAttemptId: string
    spendClass: SpendClass
    config: ElementGenerationCostConfiguration
  }
) {
  await prisma.elementGenerationSpend.create({
    data: {
      buildId,
      quotaId,
      dispatchAttemptId,
      spendClass,
      semesterKey: config.semesterKey,
      estimatedCostMinorUnits: config.amountMinorUnits,
      costCurrency: config.currency,
      costPricingVersion: config.pricingVersion,
    },
  })
}

export async function createElementGenerationBuildWithSpend(
  prisma: DB.PrismaClient,
  {
    data,
    ownerId,
    idempotencyKey,
    spendClass,
    env = process.env,
    now = new Date(),
  }: {
    data: DB.Prisma.ElementGenerationBuildUncheckedCreateInput
    ownerId: string
    idempotencyKey: string
    spendClass: Exclude<SpendClass, 'FLASHCARD_RETRY'>
    env?: NodeJS.ProcessEnv
    now?: Date
  }
): Promise<{ buildId: string; created: boolean }> {
  if (
    data.ownerId !== ownerId ||
    data.idempotencyKey !== idempotencyKey ||
    (spendClass === DB.KBGraphQuotaSpendClass.QUESTION_GENERATION &&
      data.elementType === DB.ElementType.FLASHCARD) ||
    (spendClass === DB.KBGraphQuotaSpendClass.FLASHCARD_GENERATION &&
      data.elementType !== DB.ElementType.FLASHCARD)
  ) {
    throw new Error('Element-generation spend does not match its build')
  }
  const config = requireElementGenerationCostConfiguration(spendClass, env, now)
  try {
    return await prisma.$transaction(async (transaction) => {
      const quota = await ensureLockedKBGraphQuota(
        transaction,
        ownerId,
        config,
        now
      )
      // Recheck only after the owner-semester lock. Concurrent starts with the
      // same idempotency key then observe the committed winner before reserving.
      const existing = await transaction.elementGenerationBuild.findUnique({
        where: { ownerId_idempotencyKey: { ownerId, idempotencyKey } },
        select: { id: true },
      })
      if (existing) return { buildId: existing.id, created: false }

      await reserveKBGraphQuotaAmount(
        transaction,
        quota,
        config.amountMinorUnits
      )
      const build = await transaction.elementGenerationBuild.create({
        data: { ...data, costAccountingVersion: 1 },
        select: { id: true, providerDispatchAttemptId: true },
      })
      await createSpend(transaction, {
        buildId: build.id,
        quotaId: quota.id,
        dispatchAttemptId: build.providerDispatchAttemptId,
        spendClass,
        config,
      })
      return { buildId: build.id, created: true }
    })
  } catch (error) {
    if (
      !(error instanceof DB.Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error
    }
    const raced = await prisma.elementGenerationBuild.findUnique({
      where: { ownerId_idempotencyKey: { ownerId, idempotencyKey } },
      select: { id: true },
    })
    if (!raced) throw error
    return { buildId: raced.id, created: false }
  }
}

export async function reserveFlashcardRetrySpend(
  prisma: DB.PrismaClient,
  {
    buildId,
    ownerId,
    dispatchAttemptId,
    env = process.env,
    now = new Date(),
  }: {
    buildId: string
    ownerId: string
    dispatchAttemptId: string
    env?: NodeJS.ProcessEnv
    now?: Date
  }
): Promise<boolean> {
  const spendClass = DB.KBGraphQuotaSpendClass.FLASHCARD_RETRY
  const config = requireElementGenerationCostConfiguration(spendClass, env, now)
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "public"."ElementGenerationBuild"
      WHERE "id" = CAST(${buildId} AS UUID)
      FOR UPDATE
    `
    const build = await transaction.elementGenerationBuild.findFirst({
      where: {
        id: buildId,
        ownerId,
        elementType: DB.ElementType.FLASHCARD,
        status: DB.ElementGenerationBuildStatus.AWAITING_INCOMPLETE_PUBLICATION,
        costAccountingVersion: 1,
      },
      select: { id: true },
    })
    if (!build) return false

    const quota = await ensureLockedKBGraphQuota(
      transaction,
      ownerId,
      config,
      now
    )
    await reserveKBGraphQuotaAmount(transaction, quota, config.amountMinorUnits)
    await createSpend(transaction, {
      buildId,
      quotaId: quota.id,
      dispatchAttemptId,
      spendClass,
      config,
    })
    await transaction.elementGenerationBuild.update({
      where: { id: buildId },
      data: {
        status: DB.ElementGenerationBuildStatus.PREPARING_INPUT,
        stage: 'retry_dispatching',
        providerDispatchAttemptId: dispatchAttemptId,
        providerEventId: null,
        providerWorkflowRunId: null,
      },
    })
    return true
  })
}

export async function claimElementGenerationSpend(
  prisma: DB.PrismaClient,
  dispatchAttemptId: string,
  now: Date = new Date()
): Promise<boolean> {
  const updated = await prisma.elementGenerationSpend.updateMany({
    where: {
      dispatchAttemptId,
      costStatus: DB.KBGraphCostStatus.RESERVED,
      dispatchClaimedAt: null,
    },
    data: { dispatchClaimedAt: now },
  })
  if (updated.count === 1) return true
  const existing = await prisma.elementGenerationSpend.findUnique({
    where: { dispatchAttemptId },
    select: { costStatus: true, dispatchClaimedAt: true },
  })
  if (
    !existing ||
    existing.costStatus === DB.KBGraphCostStatus.RELEASED ||
    (existing.costStatus === DB.KBGraphCostStatus.RESERVED &&
      existing.dispatchClaimedAt === null)
  ) {
    throw new Error('Element-generation spend could not be claimed')
  }
  return false
}

export async function getElementGenerationSpendDispatchState(
  prisma: DB.PrismaClient,
  dispatchAttemptId: string
) {
  const spend = await prisma.elementGenerationSpend.findUnique({
    where: { dispatchAttemptId },
    select: { costStatus: true, dispatchClaimedAt: true },
  })
  if (!spend) throw new Error('Element-generation spend was not found')
  return spend
}

export async function isFlashcardRetrySpend(
  prisma: DB.PrismaClient,
  dispatchAttemptId: string
): Promise<boolean> {
  const spend = await prisma.elementGenerationSpend.findUnique({
    where: { dispatchAttemptId },
    select: { spendClass: true },
  })
  return spend?.spendClass === DB.KBGraphQuotaSpendClass.FLASHCARD_RETRY
}

export async function settleElementGenerationSpend(
  prisma: DB.PrismaClient,
  dispatchAttemptId: string,
  now: Date = new Date()
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    const candidate = await transaction.elementGenerationSpend.findUnique({
      where: { dispatchAttemptId },
      select: { quotaId: true },
    })
    if (!candidate) throw new Error('Element-generation spend was not found')
    await lockKBGraphQuota(transaction, candidate.quotaId)
    const spend = await transaction.elementGenerationSpend.findUniqueOrThrow({
      where: { dispatchAttemptId },
      select: {
        id: true,
        quotaId: true,
        costStatus: true,
        dispatchClaimedAt: true,
        estimatedCostMinorUnits: true,
      },
    })
    if (spend.costStatus === DB.KBGraphCostStatus.SETTLED) return false
    if (
      spend.costStatus !== DB.KBGraphCostStatus.RESERVED ||
      spend.dispatchClaimedAt === null
    ) {
      throw new Error('Element-generation spend is not settleable')
    }
    const spendUpdated = await transaction.elementGenerationSpend.updateMany({
      where: {
        id: spend.id,
        costStatus: DB.KBGraphCostStatus.RESERVED,
        dispatchClaimedAt: { not: null },
      },
      data: {
        costStatus: DB.KBGraphCostStatus.SETTLED,
        actualCostMinorUnits: spend.estimatedCostMinorUnits,
        finishedAt: now,
      },
    })
    if (spendUpdated.count !== 1) return false
    const quotaUpdated = await transaction.kBGraphQuota.updateMany({
      where: {
        id: spend.quotaId,
        reservedMinorUnits: { gte: spend.estimatedCostMinorUnits },
      },
      data: {
        reservedMinorUnits: { decrement: spend.estimatedCostMinorUnits },
        settledMinorUnits: { increment: spend.estimatedCostMinorUnits },
      },
    })
    if (quotaUpdated.count !== 1) {
      throw new Error('Element-generation quota could not be settled')
    }
    return true
  })
}

type SpendReleaseCondition =
  | { kind: 'UNCLAIMED' }
  | { kind: 'CLAIMED_BEFORE'; before: Date }

async function releaseElementGenerationSpend(
  prisma: Transaction,
  dispatchAttemptId: string,
  condition: SpendReleaseCondition,
  now: Date = new Date()
): Promise<boolean> {
  const candidate = await prisma.elementGenerationSpend.findUnique({
    where: { dispatchAttemptId },
    select: { quotaId: true },
  })
  if (!candidate) return false
  await lockKBGraphQuota(prisma, candidate.quotaId)
  const spend = await prisma.elementGenerationSpend.findUniqueOrThrow({
    where: { dispatchAttemptId },
    select: {
      id: true,
      quotaId: true,
      costStatus: true,
      dispatchClaimedAt: true,
      estimatedCostMinorUnits: true,
    },
  })
  const dispatchClaimMatches =
    condition.kind === 'UNCLAIMED'
      ? spend.dispatchClaimedAt === null
      : spend.dispatchClaimedAt !== null &&
        spend.dispatchClaimedAt <= condition.before
  if (
    spend.costStatus !== DB.KBGraphCostStatus.RESERVED ||
    !dispatchClaimMatches
  ) {
    return false
  }
  const spendUpdated = await prisma.elementGenerationSpend.updateMany({
    where: {
      id: spend.id,
      costStatus: DB.KBGraphCostStatus.RESERVED,
      ...(condition.kind === 'UNCLAIMED'
        ? { dispatchClaimedAt: null }
        : { dispatchClaimedAt: { lte: condition.before } }),
    },
    data: {
      costStatus: DB.KBGraphCostStatus.RELEASED,
      actualCostMinorUnits: 0,
      finishedAt: now,
    },
  })
  if (spendUpdated.count !== 1) return false
  const quotaUpdated = await prisma.kBGraphQuota.updateMany({
    where: {
      id: spend.quotaId,
      reservedMinorUnits: { gte: spend.estimatedCostMinorUnits },
    },
    data: {
      reservedMinorUnits: { decrement: spend.estimatedCostMinorUnits },
    },
  })
  if (quotaUpdated.count !== 1) {
    throw new Error('Element-generation quota could not be released')
  }
  return true
}

export function releaseUnclaimedElementGenerationSpend(
  prisma: Transaction,
  dispatchAttemptId: string,
  now: Date = new Date()
): Promise<boolean> {
  return releaseElementGenerationSpend(
    prisma,
    dispatchAttemptId,
    { kind: 'UNCLAIMED' },
    now
  )
}

export function releaseStaleClaimedElementGenerationSpend(
  prisma: DB.PrismaClient,
  dispatchAttemptId: string,
  now: Date = new Date()
): Promise<boolean> {
  return prisma.$transaction((transaction) =>
    releaseElementGenerationSpend(
      transaction,
      dispatchAttemptId,
      {
        kind: 'CLAIMED_BEFORE',
        before: new Date(
          now.getTime() - ELEMENT_GENERATION_DISPATCH_CLAIM_GRACE_MS
        ),
      },
      now
    )
  )
}
