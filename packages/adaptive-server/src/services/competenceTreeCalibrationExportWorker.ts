import type { ContainerClient } from '@azure/storage-blob'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  HatchetHandlerGlobalContext,
  HatchetHandlers,
} from '@klicker-uzh/types'
import { createHash, randomUUID } from 'node:crypto'
import { PassThrough, Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  assignAdaptiveExportSplit,
  projectAdaptiveCalibrationExportRow,
  type AdaptiveCalibrationExportSourceRow,
  type AdaptiveCalibrationExportSplit,
} from './competenceTreeCalibrationExportProjection.js'
import {
  hasCurrentAdaptiveCalibrationExportAuthority,
  type AdaptiveCalibrationExportAuthorizationScope,
} from './competenceTreeCalibrationExportRequest.js'
import {
  getAdaptiveExportContainer,
  requiredEnvironment,
} from './competenceTreeCalibrationExportStorage.js'

const EXPORT_PAGE_SIZE = 1_000
const EXPORT_SCHEMA_VERSION = 1
const RUNNING_STALE_AFTER_MINUTES = 30

type WorkerExportRequest = AdaptiveCalibrationExportAuthorizationScope & {
  requestedBy: Pick<DB.User, 'role'> | null
}

export const handleAdaptiveCalibrationExport: HatchetHandlers['handleAdaptiveCalibrationExport'] =
  async ({ exportRequestId }, globalCtx) => {
    const request = await loadExportRequestScope(
      exportRequestId,
      globalCtx.prisma
    )
    if (
      !request ||
      request.status === DB.AdaptiveCalibrationExportStatus.EXPIRED
    ) {
      return true
    }
    if (request.expiresAt <= new Date()) {
      await expireExportRequest(request, globalCtx)
      return true
    }
    if (!isWorkerExportRequestAuthorized(request)) {
      await rejectUnauthorizedExportRequest(request, globalCtx)
      return true
    }

    const startedAt = new Date()
    const runToken = await claimAdaptiveCalibrationExportRun({
      requestId: request.id,
      prisma: globalCtx.prisma,
      startedAt,
    })
    if (!runToken) {
      return request.status === DB.AdaptiveCalibrationExportStatus.READY
    }
    const executionRequest = await loadExportRequestScope(
      request.id,
      globalCtx.prisma
    )
    if (
      !executionRequest ||
      executionRequest.runToken !== runToken ||
      !isWorkerExportRequestAuthorized(executionRequest)
    ) {
      await rejectUnauthorizedExportRequest(request, globalCtx, runToken)
      return true
    }
    emitAdaptiveOperationalEvent({
      name: 'adaptive_calibration_export',
      treeId: executionRequest.treeId,
      scaleVersionId: executionRequest.scaleVersionId,
      status: 'RUNNING',
      queueAgeMs: startedAt.getTime() - executionRequest.createdAt.getTime(),
    })

    const keys = exportArtifactKeys(
      executionRequest.treeId,
      executionRequest.id,
      runToken
    )
    try {
      const container = await getAdaptiveExportContainer()
      const hmacKey = requiredEnvironment(
        'ADAPTIVE_CALIBRATION_PSEUDONYM_HMAC_KEY'
      )
      const calibration = await writeSplitArtifact({
        container,
        artifactKey: keys.calibration,
        request: executionRequest,
        split: 'CALIBRATION',
        hmacKey,
        prisma: globalCtx.prisma,
      })
      const holdout = await writeSplitArtifact({
        container,
        artifactKey: keys.holdout,
        request: executionRequest,
        split: 'HOLDOUT',
        hmacKey,
        prisma: globalCtx.prisma,
      })
      const manifest = {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        datasetVersion: executionRequest.datasetVersion,
        splitPolicyVersion: executionRequest.splitPolicyVersion,
        treeId: executionRequest.treeId,
        scaleVersionId: executionRequest.scaleVersionId,
        generatedAt: new Date().toISOString(),
        calibration: {
          checksum: calibration.checksum,
          rowCount: calibration.rowCount,
        },
        holdout: {
          checksum: holdout.checksum,
          rowCount: holdout.rowCount,
        },
      }
      const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`)
      const manifestChecksum = sha256(manifestBytes)
      await container
        .getBlockBlobClient(keys.manifest)
        .uploadData(manifestBytes, {
          blobHTTPHeaders: { blobContentType: 'application/json' },
          metadata: { schemaVersion: String(EXPORT_SCHEMA_VERSION) },
        })

      const completionRequest = await loadExportRequestScope(
        executionRequest.id,
        globalCtx.prisma
      )
      if (
        !completionRequest ||
        completionRequest.runToken !== runToken ||
        !isWorkerExportRequestAuthorized(completionRequest)
      ) {
        throw new Error('ADAPTIVE_EXPORT_AUTHORIZATION_REVOKED')
      }

      const completed =
        await globalCtx.prisma.adaptiveCalibrationExportRequest.updateMany({
          where: {
            id: executionRequest.id,
            status: DB.AdaptiveCalibrationExportStatus.RUNNING,
            runToken,
            expiresAt: { gt: new Date() },
          },
          data: {
            status: DB.AdaptiveCalibrationExportStatus.READY,
            artifactKey: keys.calibration,
            artifactChecksum: calibration.checksum,
            rowCount: calibration.rowCount,
            manifestArtifactKey: keys.manifest,
            manifestChecksum,
            holdoutArtifactKey: keys.holdout,
            holdoutArtifactChecksum: holdout.checksum,
            holdoutRowCount: holdout.rowCount,
            completedAt: new Date(),
            runToken: null,
          },
        })
      if (completed.count === 0) {
        await deleteArtifactsBestEffort(keys, globalCtx)
        const expired =
          await globalCtx.prisma.adaptiveCalibrationExportRequest.updateMany({
            where: {
              id: executionRequest.id,
              status: DB.AdaptiveCalibrationExportStatus.RUNNING,
              runToken,
              expiresAt: { lte: new Date() },
            },
            data: {
              status: DB.AdaptiveCalibrationExportStatus.EXPIRED,
              runToken: null,
            },
          })
        if (expired.count > 0) {
          emitAdaptiveOperationalEvent({
            name: 'adaptive_calibration_export',
            treeId: executionRequest.treeId,
            scaleVersionId: executionRequest.scaleVersionId,
            status: 'EXPIRED',
            processingDurationMs: Date.now() - startedAt.getTime(),
          })
        }
      } else {
        emitAdaptiveOperationalEvent({
          name: 'adaptive_calibration_export',
          treeId: executionRequest.treeId,
          scaleVersionId: executionRequest.scaleVersionId,
          status: 'READY',
          processingDurationMs: Date.now() - startedAt.getTime(),
        })
      }
      return true
    } catch (error) {
      await deleteArtifactsBestEffort(keys, globalCtx)
      const failed = await failAdaptiveCalibrationExportRun({
        requestId: executionRequest.id,
        runToken,
        failureCode: safeExportFailureCode(error),
        prisma: globalCtx.prisma,
      })
      if (failed.count === 0) return true
      emitAdaptiveOperationalEvent({
        name: 'adaptive_calibration_export',
        treeId: executionRequest.treeId,
        scaleVersionId: executionRequest.scaleVersionId,
        status: 'FAILED',
        processingDurationMs: Date.now() - startedAt.getTime(),
        failureCode: safeExportFailureCode(error),
      })
      throw error
    }
  }

export const handleAdaptiveCalibrationExportCleanup: HatchetHandlers['handleAdaptiveCalibrationExportCleanup'] =
  async (_, globalCtx) => {
    const requests =
      await globalCtx.prisma.adaptiveCalibrationExportRequest.findMany({
        where: {
          expiresAt: { lte: new Date() },
          status: {
            in: [
              DB.AdaptiveCalibrationExportStatus.REQUESTED,
              DB.AdaptiveCalibrationExportStatus.RUNNING,
              DB.AdaptiveCalibrationExportStatus.READY,
              DB.AdaptiveCalibrationExportStatus.FAILED,
            ],
          },
        },
        orderBy: { expiresAt: 'asc' },
        take: 500,
      })
    for (const request of requests) {
      await expireExportRequest(request, globalCtx)
    }
    return true
  }

async function loadExportRequestScope(
  requestId: string,
  prisma: DB.PrismaClient
): Promise<WorkerExportRequest | null> {
  return prisma.adaptiveCalibrationExportRequest.findUnique({
    where: { id: requestId },
    include: {
      tree: {
        select: { id: true, ownerId: true, isDeleted: true },
      },
      scaleVersion: {
        select: { id: true, treeId: true },
      },
      requestedBy: {
        select: { role: true },
      },
    },
  })
}

function isWorkerExportRequestAuthorized(request: WorkerExportRequest) {
  return (
    request.requestedById !== null &&
    request.requestedBy !== null &&
    hasCurrentAdaptiveCalibrationExportAuthority({
      request,
      actorId: request.requestedById,
      persistedRole: request.requestedBy.role,
    })
  )
}

async function rejectUnauthorizedExportRequest(
  request: DB.AdaptiveCalibrationExportRequest,
  globalCtx: HatchetHandlerGlobalContext,
  runToken?: string
) {
  const rejected =
    await globalCtx.prisma.adaptiveCalibrationExportRequest.updateMany({
      where: {
        id: request.id,
        ...(runToken
          ? {
              status: DB.AdaptiveCalibrationExportStatus.RUNNING,
              runToken,
            }
          : {
              status: { not: DB.AdaptiveCalibrationExportStatus.EXPIRED },
            }),
      },
      data: {
        status: DB.AdaptiveCalibrationExportStatus.FAILED,
        failureCode: 'ADAPTIVE_EXPORT_AUTHORIZATION_REVOKED',
        completedAt: new Date(),
        runToken: null,
      },
    })
  if (rejected.count > 0) {
    emitAdaptiveOperationalEvent({
      name: 'adaptive_calibration_export',
      treeId: request.treeId,
      scaleVersionId: request.scaleVersionId,
      status: 'FAILED',
      failureCode: 'ADAPTIVE_EXPORT_AUTHORIZATION_REVOKED',
    })
  }
}

async function writeSplitArtifact({
  container,
  artifactKey,
  request,
  split,
  hmacKey,
  prisma,
}: {
  container: ContainerClient
  artifactKey: string
  request: DB.AdaptiveCalibrationExportRequest
  split: AdaptiveCalibrationExportSplit
  hmacKey: string
  prisma: DB.PrismaClient
}) {
  let rowCount = 0
  async function* lines() {
    for await (const row of selectFirstExposureRows(request, prisma)) {
      if (
        assignAdaptiveExportSplit({
          hmacKey,
          treeId: request.treeId,
          datasetVersion: request.datasetVersion,
          subjectKey: row.subjectKey,
        }) !== split
      ) {
        continue
      }
      const projected = projectAdaptiveCalibrationExportRow({
        row,
        treeId: request.treeId,
        datasetVersion: request.datasetVersion,
        hmacKey,
      })
      rowCount += 1
      yield Buffer.from(`${JSON.stringify(projected)}\n`)
    }
  }

  const hash = createHash('sha256')
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  const uploadInput = new PassThrough()
  const upload = container
    .getBlockBlobClient(artifactKey)
    .uploadStream(uploadInput, 4 * 1024 * 1024, 4, {
      blobHTTPHeaders: {
        blobContentType: 'application/x-ndjson',
        blobContentEncoding: 'gzip',
      },
      metadata: { schemaVersion: String(EXPORT_SCHEMA_VERSION), split },
    })
  await Promise.all([
    pipeline(
      Readable.from(lines()),
      createGzip({ level: 9 }),
      meter,
      uploadInput
    ),
    upload,
  ])
  return { checksum: hash.digest('hex'), rowCount }
}

export async function* selectFirstExposureRows(
  request: DB.AdaptiveCalibrationExportRequest,
  prisma: DB.PrismaClient
) {
  let cursor = 0
  while (true) {
    const rows = await prisma.$queryRaw<AdaptiveCalibrationExportSourceRow[]>`
      SELECT
        response."id" AS "responseId",
        md5(
          ${request.treeId} || ':' || ${request.datasetVersion} ||
          ':subject:' || attempt."participantId"::text
        ) AS "subjectKey",
        md5(
          ${request.treeId} || ':' || ${request.datasetVersion} ||
          ':cohort:' || attempt."courseId"::text
        ) AS "cohortKey",
        publication."version" AS "publicationVersion",
        publication."measurementVersion",
        publication."estimatorImplementationVersion",
        publication."classificationPolicyVersion",
        publication."calibrationPolicyVersion",
        pool."sourceAssignmentId" AS "assignmentId",
        pool."elementId",
        pool."elementVersion",
        pool."elementType",
        pool."calibrationId",
        pool."calibrationVersion",
        pool."calibrationStatus",
        pool."itemModel",
        response."itemRole",
        response."score",
        response."correct",
        CASE
          WHEN pool."elementType" IN (
            'SC'::"ElementType",
            'MC'::"ElementType",
            'KPRIM'::"ElementType"
          ) THEN response."normalizedResponse" -> 'choiceIndices'
          ELSE NULL
        END AS "responseCategory",
        response."elapsedSeconds",
        response."administrationProbability",
        response."collectionDesignVersion",
        response."isCalibrationAnchor"
      FROM "AdaptivePracticeQuizResponse" response
      JOIN "AdaptivePracticeQuizAttempt" attempt
        ON attempt."id" = response."attemptId"
      JOIN "PracticeQuizAdaptivePublication" publication
        ON publication."id" = response."publicationId"
      JOIN "PracticeQuizAdaptivePoolItem" pool
        ON pool."publicationId" = response."publicationId"
       AND pool."id" = response."poolItemId"
      JOIN "Course" course
        ON course."id" = attempt."courseId"
      WHERE response."id" > ${cursor}
        AND attempt."competenceTreeId" = ${request.treeId}::uuid
        AND attempt."scaleVersionId" = ${request.scaleVersionId}::uuid
        AND course."isAdaptiveLearningCalibrationEnabled" = TRUE
        AND response."administrationProbability" IS NOT NULL
        AND response."collectionDesignVersion" IS NOT NULL
        AND pool."elementType" IN (
          'NUMERICAL'::"ElementType",
          'SC'::"ElementType",
          'MC'::"ElementType",
          'KPRIM'::"ElementType",
          'FREE_TEXT'::"ElementType"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "AdaptivePracticeQuizResponse" earlier_response
          JOIN "AdaptivePracticeQuizAttempt" earlier_attempt
            ON earlier_attempt."id" = earlier_response."attemptId"
          JOIN "PracticeQuizAdaptivePoolItem" earlier_pool
            ON earlier_pool."publicationId" = earlier_response."publicationId"
           AND earlier_pool."id" = earlier_response."poolItemId"
          JOIN "Course" earlier_course
            ON earlier_course."id" = earlier_attempt."courseId"
          WHERE earlier_attempt."participantId" = attempt."participantId"
            AND earlier_attempt."competenceTreeId" = attempt."competenceTreeId"
            AND earlier_pool."sourceAssignmentId" = pool."sourceAssignmentId"
            AND earlier_pool."elementVersion" = pool."elementVersion"
            AND earlier_course."isAdaptiveLearningCalibrationEnabled" = TRUE
            AND earlier_response."administrationProbability" IS NOT NULL
            AND earlier_response."collectionDesignVersion" IS NOT NULL
            AND (
              earlier_response."createdAt" < response."createdAt"
              OR (
                earlier_response."createdAt" = response."createdAt"
                AND earlier_response."id" < response."id"
              )
            )
        )
      ORDER BY response."id" ASC
      LIMIT ${EXPORT_PAGE_SIZE}
    `
    if (rows.length === 0) return
    for (const row of rows) yield row
    cursor = rows.at(-1)!.responseId
  }
}

async function expireExportRequest(
  request: DB.AdaptiveCalibrationExportRequest,
  globalCtx: HatchetHandlerGlobalContext
) {
  const container = await getAdaptiveExportContainer()
  for (const key of [
    request.artifactKey,
    request.manifestArtifactKey,
    request.holdoutArtifactKey,
    request.criterionArtifactKey,
    ...(request.runToken
      ? Object.values(
          exportArtifactKeys(request.treeId, request.id, request.runToken)
        )
      : []),
  ]) {
    if (key) {
      await container
        .getBlobClient(key)
        .deleteIfExists({ deleteSnapshots: 'include' })
    }
  }
  const expired =
    await globalCtx.prisma.adaptiveCalibrationExportRequest.updateMany({
      where: {
        id: request.id,
        status: { not: DB.AdaptiveCalibrationExportStatus.EXPIRED },
      },
      data: {
        status: DB.AdaptiveCalibrationExportStatus.EXPIRED,
        runToken: null,
      },
    })
  if (expired.count > 0) {
    emitAdaptiveOperationalEvent({
      name: 'adaptive_calibration_export',
      treeId: request.treeId,
      scaleVersionId: request.scaleVersionId,
      status: 'EXPIRED',
      processingDurationMs:
        request.startedAt === null
          ? undefined
          : Date.now() - request.startedAt.getTime(),
    })
  }
}

async function deleteArtifactsBestEffort(
  keys: ReturnType<typeof exportArtifactKeys>,
  globalCtx: HatchetHandlerGlobalContext
) {
  try {
    const container = await getAdaptiveExportContainer()
    await Promise.all(
      Object.values(keys).map((key) =>
        container
          .getBlobClient(key)
          .deleteIfExists({ deleteSnapshots: 'include' })
          .catch(() => {})
      )
    )
  } catch {
    globalCtx.emitter.emit('adaptive-calibration-export-cleanup-failed')
  }
}

export async function claimAdaptiveCalibrationExportRun({
  requestId,
  prisma,
  startedAt = new Date(),
  runToken = randomUUID(),
}: {
  requestId: string
  prisma: DB.PrismaClient
  startedAt?: Date
  runToken?: string
}): Promise<string | null> {
  const staleBefore = new Date(
    startedAt.getTime() - RUNNING_STALE_AFTER_MINUTES * 60 * 1_000
  )
  const claimed = await prisma.adaptiveCalibrationExportRequest.updateMany({
    where: {
      id: requestId,
      OR: [
        {
          status: {
            in: [
              DB.AdaptiveCalibrationExportStatus.REQUESTED,
              DB.AdaptiveCalibrationExportStatus.FAILED,
            ],
          },
        },
        {
          status: DB.AdaptiveCalibrationExportStatus.RUNNING,
          startedAt: { lt: staleBefore },
        },
      ],
    },
    data: {
      status: DB.AdaptiveCalibrationExportStatus.RUNNING,
      runToken,
      startedAt,
      completedAt: null,
      failureCode: null,
    },
  })
  return claimed.count === 1 ? runToken : null
}

export async function failAdaptiveCalibrationExportRun({
  requestId,
  runToken,
  failureCode,
  prisma,
  completedAt = new Date(),
}: {
  requestId: string
  runToken: string
  failureCode: string
  prisma: DB.PrismaClient
  completedAt?: Date
}) {
  return await prisma.adaptiveCalibrationExportRequest.updateMany({
    where: {
      id: requestId,
      status: DB.AdaptiveCalibrationExportStatus.RUNNING,
      runToken,
    },
    data: {
      status: DB.AdaptiveCalibrationExportStatus.FAILED,
      failureCode,
      completedAt,
      runToken: null,
    },
  })
}

export function exportArtifactKeys(
  treeId: string,
  requestId: string,
  runToken: string
) {
  const prefix = `${treeId}/${requestId}/${runToken}`
  return {
    calibration: `${prefix}/calibration.ndjson.gz`,
    holdout: `${prefix}/sealed-holdout.ndjson.gz`,
    manifest: `${prefix}/manifest.json`,
  }
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function safeExportFailureCode(error: unknown) {
  if (
    error instanceof Error &&
    /^ADAPTIVE_EXPORT_[A-Z_]+$/.test(error.message)
  ) {
    return error.message
  }
  return 'ADAPTIVE_EXPORT_PROCESSING_FAILED'
}
