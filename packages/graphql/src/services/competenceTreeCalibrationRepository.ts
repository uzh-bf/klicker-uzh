import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import {
  isRetryableAdaptiveTransactionConflict,
  waitForAdaptiveTransactionRetry,
} from './adaptiveTransactions.js'
import {
  competenceTreeServiceError,
  lockOwnedCompetenceTree,
} from './competenceTreeRepository.js'

const CALIBRATION_TRANSACTION_RETRIES = 3

export type LockedScaleVersion = {
  id: string
  treeId: string
  version: number
  status: DB.AdaptiveScaleVersionStatus
  supersedesVersionId: string | null
  createdById: string | null
}

export type LockedScaleLink = {
  id: string
  treeId: string
  fromScaleVersionId: string
  toScaleVersionId: string
  status: DB.AdaptiveScaleLinkStatus
  createdById: string | null
}

export type LockedCalibration = {
  id: string
  treeId: string
  scaleVersionId: string
  status: DB.AdaptiveItemCalibrationStatus
  createdById: string | null
  diagnostics: PrismaJson.PrismaAdaptiveCalibrationDiagnostics
  responseCount: number
  participantCount: number
}

export function calibrationServiceError(message: string, code: string) {
  return competenceTreeServiceError(message, code)
}

export async function assertAdaptiveReviewer(
  tx: DB.Prisma.TransactionClient,
  ctx: ContextWithUser
) {
  assertAdaptiveManagementWriteAccess(ctx)
  if (ctx.user.role !== DB.UserRole.ADMIN) {
    throw calibrationServiceError(
      'Independent adaptive measurement review requires an administrator.',
      'FORBIDDEN'
    )
  }
  const rows = await tx.$queryRaw<Array<{ role: DB.UserRole }>>`
    SELECT "role"
    FROM "User"
    WHERE "id" = ${ctx.user.sub}::uuid
    FOR SHARE
  `
  if (rows[0]?.role !== DB.UserRole.ADMIN) {
    throw calibrationServiceError(
      'Independent adaptive measurement review requires an administrator.',
      'FORBIDDEN'
    )
  }
}

export async function lockOwnedCalibrationTree(
  tx: DB.Prisma.TransactionClient,
  treeId: string,
  ctx: ContextWithUser
) {
  assertAdaptiveManagementWriteAccess(ctx)
  await lockOwnedCompetenceTree(tx, treeId, ctx.user.sub)
}

export function assertAdaptiveManagementWriteAccess(ctx: ContextWithUser) {
  if (
    ctx.user.scope !== DB.UserLoginScope.FULL_ACCESS &&
    ctx.user.scope !== DB.UserLoginScope.ACCOUNT_OWNER
  ) {
    throw calibrationServiceError(
      'Adaptive measurement management requires full account access.',
      'FORBIDDEN'
    )
  }
}

export async function lockScaleVersion(
  tx: DB.Prisma.TransactionClient,
  scaleVersionId: string
): Promise<LockedScaleVersion> {
  const rows = await tx.$queryRaw<LockedScaleVersion[]>`
    SELECT
      "id",
      "treeId",
      "version",
      "status",
      "supersedesVersionId",
      "createdById"
    FROM "CompetenceTreeScaleVersion"
    WHERE "id" = ${scaleVersionId}::uuid
    FOR UPDATE
  `
  const scale = rows[0]
  if (!scale) {
    throw calibrationServiceError('Scale version not found.', 'NOT_FOUND')
  }
  return scale
}

export async function lockScaleLink(
  tx: DB.Prisma.TransactionClient,
  scaleLinkId: string
): Promise<LockedScaleLink> {
  const rows = await tx.$queryRaw<LockedScaleLink[]>`
    SELECT
      "id",
      "treeId",
      "fromScaleVersionId",
      "toScaleVersionId",
      "status",
      "createdById"
    FROM "CompetenceTreeScaleLink"
    WHERE "id" = ${scaleLinkId}::uuid
    FOR UPDATE
  `
  const link = rows[0]
  if (!link) {
    throw calibrationServiceError('Scale link not found.', 'NOT_FOUND')
  }
  return link
}

export async function lockCalibration(
  tx: DB.Prisma.TransactionClient,
  calibrationId: string
): Promise<LockedCalibration> {
  const rows = await tx.$queryRaw<LockedCalibration[]>`
    SELECT
      "id",
      "treeId",
      "scaleVersionId",
      "status",
      "createdById",
      "diagnostics",
      "responseCount",
      "participantCount"
    FROM "AdaptiveItemCalibration"
    WHERE "id" = ${calibrationId}::uuid
    FOR UPDATE
  `
  const calibration = rows[0]
  if (!calibration) {
    throw calibrationServiceError('Calibration not found.', 'NOT_FOUND')
  }
  return calibration
}

export async function lockEmpiricalValidation(
  tx: DB.Prisma.TransactionClient,
  validationId: string
) {
  const rows = await tx.$queryRaw<
    Array<{
      id: string
      competenceTreeId: string
      status: DB.AdaptiveEmpiricalValidationStatus
      submittedById: string | null
    }>
  >`
    SELECT "id", "competenceTreeId", "status", "submittedById"
    FROM "AdaptivePracticeQuizEmpiricalValidation"
    WHERE "id" = ${validationId}::uuid
    FOR UPDATE
  `
  const validation = rows[0]
  if (!validation) {
    throw calibrationServiceError(
      'Empirical validation not found.',
      'NOT_FOUND'
    )
  }
  return validation
}

export async function calibrationTransaction<T>(
  ctx: ContextWithUser,
  operation: (tx: DB.Prisma.TransactionClient) => Promise<T>
) {
  for (let attempt = 0; attempt < CALIBRATION_TRANSACTION_RETRIES; attempt++) {
    try {
      return await ctx.prisma.$transaction(operation, {
        isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 30_000,
      })
    } catch (error) {
      if (isCalibrationTransactionTimeout(error)) {
        throw calibrationServiceError(
          'The adaptive calibration operation could not acquire a stable transaction.',
          'ADAPTIVE_CALIBRATION_CONFLICT'
        )
      }
      if (!isRetryableAdaptiveTransactionConflict(error)) {
        throw error
      }
      if (attempt === CALIBRATION_TRANSACTION_RETRIES - 1) {
        throw calibrationServiceError(
          'The adaptive calibration operation could not acquire a stable transaction.',
          'ADAPTIVE_CALIBRATION_CONFLICT'
        )
      }
      await waitForAdaptiveTransactionRetry(attempt)
    }
  }

  throw new Error('Unreachable adaptive calibration transaction state.')
}

function isCalibrationTransactionTimeout(error: unknown) {
  return (error as { code?: string }).code === 'P2028'
}
