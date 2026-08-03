import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  createAdaptiveExportOwnerDownloadUrl,
  getPositiveIntegerEnvironment,
} from './competenceTreeCalibrationExportStorage.js'
import {
  assertAdaptiveManagementWriteAccess,
  calibrationServiceError,
  calibrationTransaction,
  lockOwnedCalibrationTree,
  lockScaleVersion,
} from './competenceTreeCalibrationRepository.js'

const DEFAULT_RETENTION_HOURS = 24

export type AdaptiveCalibrationExportAuthorizationScope =
  DB.AdaptiveCalibrationExportRequest & {
    tree: Pick<DB.CompetenceTree, 'id' | 'ownerId' | 'isDeleted'>
    scaleVersion: Pick<DB.CompetenceTreeScaleVersion, 'id' | 'treeId'>
  }

export function hasCurrentAdaptiveCalibrationExportAuthority({
  request,
  actorId,
  persistedRole,
}: {
  request: AdaptiveCalibrationExportAuthorizationScope
  actorId: string
  persistedRole: DB.UserRole | null
}) {
  const scopeMatches =
    !request.tree.isDeleted &&
    request.tree.id === request.treeId &&
    request.scaleVersion.id === request.scaleVersionId &&
    request.scaleVersion.treeId === request.treeId

  return (
    scopeMatches &&
    (request.tree.ownerId === actorId || persistedRole === DB.UserRole.ADMIN)
  )
}

export async function requestAdaptiveCalibrationExport(
  {
    treeId,
    scaleVersionId,
    datasetVersion,
  }: {
    treeId: string
    scaleVersionId: string
    datasetVersion: string
  },
  ctx: ContextWithUser
) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(datasetVersion)) {
    throw calibrationServiceError(
      'The dataset version is invalid.',
      'ADAPTIVE_EXPORT_DATASET_VERSION_INVALID'
    )
  }
  const expiresAt = new Date(
    Date.now() +
      getPositiveIntegerEnvironment(
        'ADAPTIVE_CALIBRATION_EXPORT_RETENTION_HOURS',
        DEFAULT_RETENTION_HOURS
      ) *
        60 *
        60 *
        1_000
  )
  const request = await calibrationTransaction(ctx, async (tx) => {
    await lockOwnedCalibrationTree(tx, treeId, ctx)
    const scale = await lockScaleVersion(tx, scaleVersionId)
    if (scale.treeId !== treeId) {
      throw calibrationServiceError(
        'The scale does not belong to the selected tree.',
        'ADAPTIVE_SCALE_IDENTITY_MISMATCH'
      )
    }
    if (
      scale.status !== DB.AdaptiveScaleVersionStatus.APPROVED &&
      scale.status !== DB.AdaptiveScaleVersionStatus.ACTIVE
    ) {
      throw calibrationServiceError(
        'Calibration exports require an approved scale.',
        'ADAPTIVE_EXPORT_SCALE_NOT_APPROVED'
      )
    }
    return tx.adaptiveCalibrationExportRequest.create({
      data: {
        treeId,
        scaleVersionId,
        datasetVersion,
        requestedById: ctx.user.sub,
        expiresAt,
      },
    })
  })

  try {
    await ctx.tasks.adaptiveCalibrationExport.runNoWait([
      { exportRequestId: request.id },
    ])
    emitAdaptiveOperationalEvent({
      name: 'adaptive_calibration_export',
      treeId: request.treeId,
      scaleVersionId: request.scaleVersionId,
      status: 'REQUESTED',
    })
  } catch {
    const failedTransition =
      await ctx.prisma.adaptiveCalibrationExportRequest.updateMany({
        where: {
          id: request.id,
          status: DB.AdaptiveCalibrationExportStatus.REQUESTED,
        },
        data: {
          status: DB.AdaptiveCalibrationExportStatus.FAILED,
          failureCode: 'EXPORT_ENQUEUE_FAILED',
          completedAt: new Date(),
          runToken: null,
        },
      })
    if (failedTransition.count === 0) {
      const currentRequest =
        await ctx.prisma.adaptiveCalibrationExportRequest.findUnique({
          where: { id: request.id },
        })
      if (
        currentRequest &&
        currentRequest.status !== DB.AdaptiveCalibrationExportStatus.REQUESTED
      ) {
        return projectExportRequest(currentRequest, null)
      }
      throw calibrationServiceError(
        'The calibration export could not be queued.',
        'ADAPTIVE_EXPORT_ENQUEUE_FAILED'
      )
    }
    emitAdaptiveOperationalEvent({
      name: 'adaptive_calibration_export',
      treeId: request.treeId,
      scaleVersionId: request.scaleVersionId,
      status: 'FAILED',
      queueAgeMs: Date.now() - request.createdAt.getTime(),
      failureCode: 'EXPORT_ENQUEUE_FAILED',
    })
    throw calibrationServiceError(
      'The calibration export could not be queued.',
      'ADAPTIVE_EXPORT_ENQUEUE_FAILED'
    )
  }
  return projectExportRequest(request, null)
}

export async function getAdaptiveCalibrationExportRequest(
  { requestId }: { requestId: string },
  ctx: ContextWithUser
) {
  assertAdaptiveManagementWriteAccess(ctx)
  const request = await ctx.prisma.adaptiveCalibrationExportRequest.findUnique({
    where: { id: requestId },
    include: {
      tree: {
        select: { id: true, ownerId: true, isDeleted: true },
      },
      scaleVersion: {
        select: { id: true, treeId: true },
      },
    },
  })
  const persistedRole =
    ctx.user.role === DB.UserRole.ADMIN
      ? ((
          await ctx.prisma.user.findUnique({
            where: { id: ctx.user.sub },
            select: { role: true },
          })
        )?.role ?? null)
      : null
  if (
    !request ||
    !hasCurrentAdaptiveCalibrationExportAuthority({
      request,
      actorId: ctx.user.sub,
      persistedRole,
    })
  ) {
    throw calibrationServiceError('Export request not found.', 'NOT_FOUND')
  }

  const downloadUrl =
    request.status === DB.AdaptiveCalibrationExportStatus.READY &&
    request.expiresAt > new Date() &&
    request.artifactKey
      ? createAdaptiveExportOwnerDownloadUrl(
          request.artifactKey,
          request.expiresAt
        )
      : null
  return projectExportRequest(request, downloadUrl)
}

function projectExportRequest(
  request: DB.AdaptiveCalibrationExportRequest,
  downloadUrl: string | null
) {
  return {
    id: request.id,
    treeId: request.treeId,
    scaleVersionId: request.scaleVersionId,
    datasetVersion: request.datasetVersion,
    splitPolicyVersion: request.splitPolicyVersion,
    status: request.status,
    artifactChecksum: request.artifactChecksum,
    rowCount: request.rowCount,
    failureCode: request.failureCode,
    createdAt: request.createdAt,
    startedAt: request.startedAt,
    completedAt: request.completedAt,
    expiresAt: request.expiresAt,
    downloadUrl,
  }
}

export type AdaptiveCalibrationExportRequestView = ReturnType<
  typeof projectExportRequest
>
