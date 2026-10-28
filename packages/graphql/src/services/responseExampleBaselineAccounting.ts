import { randomUUID } from 'node:crypto'
import { getEffectiveChatAccountUsage } from '@klicker-uzh/prisma'
import { Prisma, type PrismaClient } from '@klicker-uzh/prisma/client'
import {
  getZurichMonthStart,
  isChatUsageClassEntitled,
} from '@klicker-uzh/util'

type Transaction = Prisma.TransactionClient
type BaselineStage = 'TARGET' | 'JUDGE'

export class BaselineAccountingError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'BaselineAccountingError'
    this.code = code
  }
}

function fail(code: string): never {
  throw new BaselineAccountingError(code)
}

function validRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value < 1e12
}

async function lockOwner(tx: Transaction, ownerId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${ownerId}::uuid FOR UPDATE`
  )
  const owner = await tx.user.findUnique({
    where: { id: ownerId },
    select: {
      aiFeaturesEnabled: true,
      aiSubscriptionTier: true,
      aiChatbotCostCenter: true,
    },
  })
  if (!owner) fail('BASELINE_OWNER_NOT_FOUND')
  return owner
}

async function operationIsCurrent(
  tx: Transaction,
  operation: {
    ownerId: string
    chatbotId: string
    runId: string
    caseId: string
    stage: BaselineStage
  },
  owner: {
    aiFeaturesEnabled: boolean
    aiSubscriptionTier: 'BASE' | 'ADVANCED'
    aiChatbotCostCenter: string | null
  },
  now: Date
): Promise<boolean> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Chatbot" WHERE "id"=${operation.chatbotId}::uuid FOR UPDATE`
  )
  if (
    !isChatUsageClassEntitled({
      usageClass: 'BASE',
      aiFeaturesEnabled: owner.aiFeaturesEnabled,
      aiSubscriptionTier: owner.aiSubscriptionTier,
      aiChatbotCostCenter: owner.aiChatbotCostCenter,
    })
  )
    return false

  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Chatbot" WHERE "id"=${operation.chatbotId}::uuid FOR UPDATE`
  )
  const report = await tx.responseExampleBaselineReport.findUnique({
    where: { id: operation.runId },
    include: {
      set: {
        select: { chatbotId: true, baselineReport: { select: { id: true } } },
      },
    },
  })
  if (
    !report ||
    report.ownerId !== operation.ownerId ||
    !['QUEUED', 'RUNNING'].includes(report.status) ||
    report.deadline <= now ||
    report.set.chatbotId !== operation.chatbotId ||
    report.set.baselineReport?.id !== operation.runId
  )
    return false

  const chatbot = await tx.chatbot.findFirst({
    where: {
      id: operation.chatbotId,
      ownerId: operation.ownerId,
      status: { not: 'PAUSED' },
      owner: { aiFeaturesEnabled: true },
    },
    select: { id: true },
  })
  if (!chatbot) return false

  const responseCase = await tx.responseExampleBaselineCase.findFirst({
    where: {
      id: operation.caseId,
      reportId: operation.runId,
      status: operation.stage === 'TARGET' ? 'PENDING' : 'TARGET_COMPLETE',
    },
    select: { id: true },
  })
  return Boolean(responseCase)
}

async function releaseInvalidClaims(
  tx: Transaction,
  ownerId: string,
  owner: Awaited<ReturnType<typeof lockOwner>>,
  now: Date
) {
  const claims = await tx.responseExampleBaselineOperation.findMany({
    where: { ownerId, status: 'CLAIMED', ownerSlotId: { not: null } },
  })
  for (const claim of claims) {
    const valid = await operationIsCurrent(tx, claim, owner, now)
    if (!valid) {
      await tx.responseExampleBaselineOperation.updateMany({
        where: { id: claim.id, status: 'CLAIMED', ownerSlotId: ownerId },
        data: { status: 'RELEASED', ownerSlotId: null },
      })
    }
  }
}

export async function claimBaselineOperation(
  prisma: PrismaClient,
  args: {
    ownerId: string
    chatbotId: string
    runId: string
    caseId: string
    stage: BaselineStage
    inputRate: number
    outputRate: number
    now?: Date
  }
) {
  const now = args.now ?? new Date()
  if (!validRate(args.inputRate) || !validRate(args.outputRate))
    fail('BASELINE_RATE_INVALID')

  return prisma.$transaction(async (tx) => {
    const owner = await lockOwner(tx, args.ownerId)
    const uniqueWhere = {
      runId_caseId_stage: {
        runId: args.runId,
        caseId: args.caseId,
        stage: args.stage,
      },
    } as const
    if (
      await tx.responseExampleBaselineOperation.findUnique({
        where: uniqueWhere,
      })
    )
      return null

    await releaseInvalidClaims(tx, args.ownerId, owner, now)
    const occupied = await tx.responseExampleBaselineOperation.findFirst({
      where: { ownerId: args.ownerId, ownerSlotId: { not: null } },
      select: { id: true },
    })
    if (occupied) fail('BASELINE_OPERATION_IN_FLIGHT')

    const current = await operationIsCurrent(tx, { ...args }, owner, now)
    if (!current) fail('BASELINE_OPERATION_NOT_CURRENT')

    const monthStart = getZurichMonthStart(now)
    const effective = await getEffectiveChatAccountUsage(tx, {
      ownerId: args.ownerId,
      usageClass: 'BASE',
      monthStart,
    })
    const usage = await tx.chatAccountUsage.upsert({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: args.ownerId,
          usageClass: 'BASE',
          monthStart,
        },
      },
      create: {
        ownerId: args.ownerId,
        usageClass: 'BASE',
        monthStart,
        budgetCredits: effective?.budgetCredits ?? new Prisma.Decimal(0),
        usedCredits: effective?.usedCredits ?? new Prisma.Decimal(0),
      },
      update: {},
    })
    if (!usage.budgetCredits.minus(usage.usedCredits).greaterThan(0))
      fail('BASELINE_BUDGET_EXHAUSTED')

    const report = await tx.responseExampleBaselineReport.findUniqueOrThrow({
      where: { id: args.runId },
      select: { deadline: true },
    })
    const id = randomUUID()
    return tx.responseExampleBaselineOperation.create({
      data: {
        id,
        ownerId: args.ownerId,
        ownerSlotId: args.ownerId,
        chatbotId: args.chatbotId,
        runId: args.runId,
        caseId: args.caseId,
        stage: args.stage,
        monthStart,
        inputRate: new Prisma.Decimal(args.inputRate),
        outputRate: new Prisma.Decimal(args.outputRate),
        expiresAt: report.deadline,
      },
    })
  })
}

export async function markBaselineOperationDispatched(
  prisma: PrismaClient,
  operationId: string,
  now = new Date()
): Promise<boolean> {
  const initial = await prisma.responseExampleBaselineOperation.findUnique({
    where: { id: operationId },
    select: { ownerId: true },
  })
  if (!initial) return false

  return prisma.$transaction(async (tx) => {
    const owner = await lockOwner(tx, initial.ownerId)
    const operation = await tx.responseExampleBaselineOperation.findUnique({
      where: { id: operationId },
    })
    if (operation?.status !== 'CLAIMED') return false
    const valid = await operationIsCurrent(tx, operation, owner, now)
    if (!valid) {
      await tx.responseExampleBaselineOperation.updateMany({
        where: { id: operationId, status: 'CLAIMED' },
        data: { status: 'RELEASED', ownerSlotId: null },
      })
      return false
    }
    const changed = await tx.responseExampleBaselineOperation.updateMany({
      where: { id: operationId, status: 'CLAIMED' },
      data: { status: 'DISPATCHED', dispatchedAt: now },
    })
    return changed.count === 1
  })
}

function validTokenCount(value: number | null): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export async function settleBaselineOperation(
  prisma: PrismaClient,
  args: {
    operationId: string
    inputTokens: number | null
    outputTokens: number | null
    usageComplete?: boolean
    now?: Date
  }
): Promise<'SETTLED' | 'UNCERTAIN' | 'DUPLICATE'> {
  const initial = await prisma.responseExampleBaselineOperation.findUnique({
    where: { id: args.operationId },
    select: { ownerId: true },
  })
  if (!initial) return 'DUPLICATE'
  const now = args.now ?? new Date()

  return prisma.$transaction(async (tx) => {
    await lockOwner(tx, initial.ownerId)
    const operation = await tx.responseExampleBaselineOperation.findUnique({
      where: { id: args.operationId },
    })
    if (!operation || !['DISPATCHED', 'UNCERTAIN'].includes(operation.status))
      return 'DUPLICATE'

    const usageComplete = args.usageComplete ?? true
    if (
      !validTokenCount(args.inputTokens) ||
      !validTokenCount(args.outputTokens)
    ) {
      await tx.responseExampleBaselineOperation.update({
        where: { id: operation.id },
        data: { status: 'UNCERTAIN' },
      })
      return 'UNCERTAIN'
    }

    const reportedCredits = operation.inputRate
      .mul(args.inputTokens)
      .plus(operation.outputRate.mul(args.outputTokens))
      .div(1_000_000)
      .toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
    const previouslyCharged = operation.creditsUsed ?? new Prisma.Decimal(0)
    if (reportedCredits.lessThan(previouslyCharged)) {
      await tx.responseExampleBaselineOperation.update({
        where: { id: operation.id },
        data: { status: 'UNCERTAIN' },
      })
      return 'UNCERTAIN'
    }
    const chargeDelta = reportedCredits.minus(previouslyCharged)

    if (chargeDelta.greaterThan(0)) {
      await tx.chatAccountUsage.upsert({
        where: {
          ownerId_usageClass_monthStart: {
            ownerId: operation.ownerId,
            usageClass: 'BASE',
            monthStart: operation.monthStart,
          },
        },
        create: {
          ownerId: operation.ownerId,
          usageClass: 'BASE',
          monthStart: operation.monthStart,
          budgetCredits: new Prisma.Decimal(0),
          usedCredits: chargeDelta,
        },
        update: { usedCredits: { increment: chargeDelta } },
      })
    }
    await tx.responseExampleBaselineOperation.update({
      where: { id: operation.id },
      data: {
        status: usageComplete ? 'SETTLED' : 'UNCERTAIN',
        creditsUsed: reportedCredits,
        settledAt: usageComplete ? now : null,
        ownerSlotId: usageComplete ? null : operation.ownerSlotId,
      },
    })
    return usageComplete ? 'SETTLED' : 'UNCERTAIN'
  })
}

export async function releaseBaselineOperation(
  prisma: PrismaClient,
  operationId: string
): Promise<boolean> {
  const initial = await prisma.responseExampleBaselineOperation.findUnique({
    where: { id: operationId },
    select: { ownerId: true },
  })
  if (!initial) return false

  return prisma.$transaction(async (tx) => {
    await lockOwner(tx, initial.ownerId)
    const result = await tx.responseExampleBaselineOperation.updateMany({
      where: {
        id: operationId,
        status: 'CLAIMED',
        ownerSlotId: initial.ownerId,
      },
      data: { status: 'RELEASED', ownerSlotId: null },
    })
    return result.count === 1
  })
}
