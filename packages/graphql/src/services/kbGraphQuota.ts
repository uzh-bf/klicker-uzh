import { randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

export type KBGraphQuotaTransaction = DB.Prisma.TransactionClient

export type KBGraphQuotaConfiguration = {
  semesterKey: string
  currency: string
  semesterQuotaMinorUnits: number
}

export type KBGraphQuotaLimitResolution = {
  limitMinorUnits: number
  source: 'configured' | 'granted'
  configuredBelowGranted: boolean
}

// The configured semester quota may be raised without touching existing ledger
// rows: a configured value at or above the granted row limit becomes the
// effective limit. A configured value below the granted limit never shrinks a
// quota that was already granted; lowering it is a deliberate administrative
// change to the row itself.
export function resolveKBGraphQuotaLimit(
  grantedLimitMinorUnits: number,
  configuredLimitMinorUnits: number | null
): KBGraphQuotaLimitResolution {
  if (
    configuredLimitMinorUnits !== null &&
    configuredLimitMinorUnits >= grantedLimitMinorUnits
  ) {
    return {
      limitMinorUnits: configuredLimitMinorUnits,
      source: 'configured',
      configuredBelowGranted: false,
    }
  }
  return {
    limitMinorUnits: grantedLimitMinorUnits,
    source: 'granted',
    configuredBelowGranted: configuredLimitMinorUnits !== null,
  }
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
    locked.currency !== config.currency
  ) {
    throw new GraphQLError(
      'KB graph quota configuration changed mid-semester',
      { extensions: { code: 'KB_GRAPH_QUOTA_CONFIGURATION_CHANGED' } }
    )
  }

  const resolution = resolveKBGraphQuotaLimit(
    locked.limitMinorUnits,
    config.semesterQuotaMinorUnits
  )
  if (resolution.limitMinorUnits > locked.limitMinorUnits) {
    // The row is already locked FOR UPDATE, so admissions are serialized. The
    // strictly-lower guard additionally keeps the write monotonic: a stale or
    // repeated raise matches no row and can never reduce a granted limit.
    const raised = await prisma.kBGraphQuota.updateMany({
      where: {
        id: locked.id,
        limitMinorUnits: { lt: resolution.limitMinorUnits },
      },
      data: { limitMinorUnits: resolution.limitMinorUnits },
    })
    if (raised.count !== 1) {
      throw new Error('KB graph quota limit could not be raised')
    }
    console.info('KB graph quota limit raised to the configured value', {
      event: 'kb_graph_quota_limit_raised',
      quotaId: locked.id,
      semesterKey: locked.semesterKey,
      previousLimitMinorUnits: locked.limitMinorUnits,
      limitMinorUnits: resolution.limitMinorUnits,
    })
  } else if (resolution.configuredBelowGranted) {
    console.warn(
      'KB graph quota configuration is below the granted limit; keeping the granted limit',
      {
        event: 'kb_graph_quota_limit_lowering_ignored',
        quotaId: locked.id,
        semesterKey: locked.semesterKey,
        grantedLimitMinorUnits: locked.limitMinorUnits,
        configuredLimitMinorUnits: config.semesterQuotaMinorUnits,
      }
    )
  }
  return { ...locked, limitMinorUnits: resolution.limitMinorUnits }
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
