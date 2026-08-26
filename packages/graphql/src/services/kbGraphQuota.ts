import { randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export type KBGraphQuotaTransaction = DB.Prisma.TransactionClient

export type KBGraphQuotaConfiguration = {
  semesterKey: string
  currency: string
  semesterQuotaMinorUnits: number
}

export type LockedKBGraphQuota = {
  id: string
  ownerId: string
  semesterKey: string
  currency: string
  limitMinorUnits: number
  reservedMinorUnits: number
  settledMinorUnits: number
}

export async function lockKBGraphQuota(
  prisma: KBGraphQuotaTransaction,
  quotaId: string
): Promise<void> {
  await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "public"."KBGraphQuota"
    WHERE "id" = CAST(${quotaId} AS UUID)
    FOR UPDATE
  `
}

export async function ensureLockedKBGraphQuota(
  prisma: KBGraphQuotaTransaction,
  ownerId: string,
  config: KBGraphQuotaConfiguration,
  now: Date
): Promise<LockedKBGraphQuota> {
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
  await lockKBGraphQuota(prisma, quota.id)
  const locked = await prisma.kBGraphQuota.findUniqueOrThrow({
    where: { id: quota.id },
    select: {
      id: true,
      ownerId: true,
      semesterKey: true,
      currency: true,
      limitMinorUnits: true,
      reservedMinorUnits: true,
      settledMinorUnits: true,
    },
  })
  if (
    locked.ownerId !== ownerId ||
    locked.semesterKey !== config.semesterKey ||
    locked.currency !== config.currency ||
    locked.limitMinorUnits !== config.semesterQuotaMinorUnits
  ) {
    throw new GraphQLError(
      'KB graph quota configuration changed mid-semester',
      { extensions: { code: 'KB_GRAPH_QUOTA_CONFIGURATION_CHANGED' } }
    )
  }
  return locked
}

export async function reserveKBGraphQuotaAmount(
  prisma: KBGraphQuotaTransaction,
  quota: LockedKBGraphQuota,
  amountMinorUnits: number
): Promise<void> {
  const usedMinorUnits = quota.reservedMinorUnits + quota.settledMinorUnits
  if (usedMinorUnits + amountMinorUnits > quota.limitMinorUnits) {
    throw new GraphQLError('KB graph semester quota is insufficient', {
      extensions: {
        code: 'KB_GRAPH_QUOTA_EXCEEDED',
        remainingMinorUnits: Math.max(
          0,
          quota.limitMinorUnits - usedMinorUnits
        ),
      },
    })
  }
  await prisma.kBGraphQuota.update({
    where: { id: quota.id },
    data: { reservedMinorUnits: { increment: amountMinorUnits } },
  })
}
