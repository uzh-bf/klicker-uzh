import {
  ADAPTIVE_V2_DIAGNOSTIC_RELEASE,
  type AdaptiveScaleDefinition,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline'
import { Readable, Transform } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { z } from 'zod'
import {
  ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
  ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
} from './adaptivePracticeQuizV2Selection.js'
import { checksum } from './competenceTreeCalibrationCommandUtils.js'
import {
  hasCurrentAdaptiveCalibrationExportAuthority,
  type AdaptiveCalibrationExportAuthorizationScope,
} from './competenceTreeCalibrationExportRequest.js'
import { getAdaptiveExportContainer } from './competenceTreeCalibrationExportStorage.js'
import { resolveAdaptiveValidationCandidate } from './competenceTreeCalibrationValidationCandidate.js'
import {
  adaptiveValidationCriterionSchema,
  adaptiveValidationGateFailures,
  createAdaptiveValidationAccumulator,
} from './competenceTreeCalibrationValidationPolicy.js'

const MAXIMUM_CRITERION_ARTIFACT_BYTES = 16 * 1024 * 1024

const validationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetVersion: z.string().trim().min(1).max(160),
    splitPolicyVersion: z.string().trim().min(1).max(160),
    treeId: z.string().uuid(),
    scaleVersionId: z.string().uuid(),
    generatedAt: z.string().datetime({ offset: true }),
    calibration: z
      .object({
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
        rowCount: z.number().int().nonnegative(),
      })
      .strict(),
    holdout: z
      .object({
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
        rowCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

type ValidationExportRequest = AdaptiveCalibrationExportAuthorizationScope & {
  requestedBy: Pick<DB.User, 'role'> | null
}

export const handleAdaptiveEmpiricalValidation: HatchetHandlers['handleAdaptiveEmpiricalValidation'] =
  async (input, globalCtx) => {
    assertReleasedIdentity(input)
    const request = await loadValidationExportRequest(
      input.exportRequestId,
      globalCtx.prisma
    )
    assertValidationExportRequest(request, input)

    const candidate = await resolveAdaptiveValidationCandidate({
      configId: input.configId,
      treeId: input.treeId,
      scaleVersionId: input.scaleVersionId,
      prisma: globalCtx.prisma,
    })
    if (
      candidate.bankFingerprint !== input.bankFingerprint ||
      candidate.configFingerprint !== input.configFingerprint
    ) {
      throw new Error('ADAPTIVE_VALIDATION_FINGERPRINT_MISMATCH')
    }

    const container = await getAdaptiveExportContainer()
    const existing = await findExistingValidation(input, globalCtx.prisma)
    if (existing) {
      await deletePersistedCriterionArtifact({
        container,
        requestId: request.id,
        criterionArtifactKey: input.criterionArtifactKey,
        criterionArtifactChecksum: input.criterionArtifactChecksum,
        prisma: globalCtx.prisma,
      })
      return existing.id
    }

    const manifest = validationManifestSchema.parse(
      JSON.parse(
        (
          await downloadVerifiedArtifact({
            stream: await downloadArtifact(
              container,
              requireValue(request.manifestArtifactKey)
            ),
            expectedChecksum: requireValue(request.manifestChecksum),
            maximumBytes: MAXIMUM_CRITERION_ARTIFACT_BYTES,
          })
        ).toString('utf8')
      )
    )
    assertManifestMatchesRequest(manifest, request)

    const criterionBytes = await downloadVerifiedArtifact({
      stream: await downloadArtifact(container, input.criterionArtifactKey),
      expectedChecksum: input.criterionArtifactChecksum,
      maximumBytes: MAXIMUM_CRITERION_ARTIFACT_BYTES,
    })
    const criterion = adaptiveValidationCriterionSchema.parse(
      JSON.parse(criterionBytes.toString('utf8'))
    )
    if (
      criterion.exportRequestId !== request.id ||
      criterion.holdoutArtifactChecksum !== request.holdoutArtifactChecksum
    ) {
      throw new Error('ADAPTIVE_VALIDATION_CRITERION_IDENTITY_MISMATCH')
    }

    const accumulator = createAdaptiveValidationAccumulator({
      criterion,
      calibrations: candidate.calibrations,
      expectedIdentity: {
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        estimatorImplementationVersion:
          ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
        classificationPolicyVersion:
          ADAPTIVE_V2_DIAGNOSTIC_RELEASE.classificationPolicyVersion,
        calibrationPolicyVersion: ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
      },
    })
    await readVerifiedHoldoutRows({
      stream: await downloadArtifact(
        container,
        requireValue(request.holdoutArtifactKey)
      ),
      expectedChecksum: requireValue(request.holdoutArtifactChecksum),
      add: accumulator.add,
    })
    const metrics = accumulator.evaluate({
      scale: toAdaptiveScale(candidate.scale),
      approvedProbabilityThreshold: input.approvedProbabilityThreshold,
      totalQuestionCap: candidate.config.totalQuestionCap,
    })
    const gateFailures = adaptiveValidationGateFailures(metrics)
    const artifact = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      exportRequestId: request.id,
      criterionVersion: criterion.criterionVersion,
      criterionArtifactChecksum: input.criterionArtifactChecksum,
      bankFingerprint: candidate.bankFingerprint,
      configFingerprint: candidate.configFingerprint,
      measurementVersion: input.measurementVersion,
      estimatorImplementationVersion: input.estimatorImplementationVersion,
      classificationPolicyVersion: input.classificationPolicyVersion,
      calibrationPolicyVersion: input.calibrationPolicyVersion,
      validationProtocolVersion: input.validationProtocolVersion,
      approvedProbabilityThreshold: input.approvedProbabilityThreshold,
      aggregateMetrics: metrics.aggregateMetrics,
      stratumMetrics: metrics.stratumMetrics,
      gateFailures,
    }
    const artifactBytes = Buffer.from(`${JSON.stringify(artifact)}\n`)
    const artifactChecksum = sha256(artifactBytes)
    const artifactKey = adaptiveValidationArtifactKey(input)
    await container.getBlockBlobClient(artifactKey).uploadData(artifactBytes, {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      metadata: { schemaVersion: '1' },
    })

    try {
      const validation = await globalCtx.prisma.$transaction(
        async (tx) => {
          await lockValidationEvidenceBoundary(tx, input)
          const currentRequest = await loadValidationExportRequest(
            input.exportRequestId,
            tx
          )
          assertValidationExportRequest(currentRequest, input)
          assertExportEvidenceUnchanged(currentRequest, request)

          const currentCandidate = await resolveAdaptiveValidationCandidate({
            configId: input.configId,
            treeId: input.treeId,
            scaleVersionId: input.scaleVersionId,
            prisma: tx,
          })
          if (
            currentCandidate.bankFingerprint !== input.bankFingerprint ||
            currentCandidate.configFingerprint !== input.configFingerprint
          ) {
            throw new Error('ADAPTIVE_VALIDATION_FINGERPRINT_MISMATCH')
          }

          const existingValidation = await findExistingValidation(input, tx)
          if (existingValidation) return existingValidation

          return tx.adaptivePracticeQuizEmpiricalValidation.create({
            data: {
              status:
                gateFailures.length === 0
                  ? DB.AdaptiveEmpiricalValidationStatus.SUBMITTED
                  : DB.AdaptiveEmpiricalValidationStatus.REJECTED,
              configId: input.configId,
              competenceTreeId: input.treeId,
              scaleVersionId: input.scaleVersionId,
              exportRequestId: input.exportRequestId,
              bankFingerprint: currentCandidate.bankFingerprint,
              configFingerprint: currentCandidate.configFingerprint,
              measurementVersion: input.measurementVersion,
              estimatorImplementationVersion:
                input.estimatorImplementationVersion,
              classificationPolicyVersion: input.classificationPolicyVersion,
              calibrationPolicyVersion: input.calibrationPolicyVersion,
              validationProtocolVersion: input.validationProtocolVersion,
              approvedProbabilityThreshold: input.approvedProbabilityThreshold,
              calibrationDatasetVersion: `${request.datasetVersion}/calibration`,
              calibrationDatasetChecksum: checksum(
                currentCandidate.calibrations.map((calibration) => ({
                  id: calibration.id,
                  datasetVersion: calibration.datasetVersion,
                  datasetChecksum: calibration.datasetChecksum,
                }))
              ),
              holdoutDatasetVersion: `${request.datasetVersion}/holdout`,
              holdoutDatasetChecksum: requireValue(
                request.holdoutArtifactChecksum
              ),
              disjointSplitProofChecksum: requireValue(
                request.manifestChecksum
              ),
              criterionArtifactChecksum: input.criterionArtifactChecksum,
              aggregateMetrics: metrics.aggregateMetrics,
              stratumMetrics: metrics.stratumMetrics,
              artifactChecksum,
              artifactKey,
              submittedById: input.submittedById,
              reviewedAt: null,
            },
          })
        },
        { isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable }
      )
      await deletePersistedCriterionArtifact({
        container,
        requestId: request.id,
        criterionArtifactKey: input.criterionArtifactKey,
        criterionArtifactChecksum: input.criterionArtifactChecksum,
        prisma: globalCtx.prisma,
      })
      return validation.id
    } catch (error) {
      const raced = await findExistingValidation(input, globalCtx.prisma)
      if (raced) {
        await deletePersistedCriterionArtifact({
          container,
          requestId: request.id,
          criterionArtifactKey: input.criterionArtifactKey,
          criterionArtifactChecksum: input.criterionArtifactChecksum,
          prisma: globalCtx.prisma,
        })
        return raced.id
      }
      await container
        .getBlobClient(artifactKey)
        .deleteIfExists({ deleteSnapshots: 'include' })
        .catch(() => {})
      throw error
    }
  }

function assertReleasedIdentity(
  input: Parameters<HatchetHandlers['handleAdaptiveEmpiricalValidation']>[0]
) {
  if (
    ADAPTIVE_V2_DIAGNOSTIC_RELEASE.validationProtocolVersion === null ||
    ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold === null
  ) {
    throw new Error('ADAPTIVE_V2_VALIDATION_PROTOCOL_UNAVAILABLE')
  }
  if (
    input.measurementVersion !== 'IRT_V2_EAP_GRID_1' ||
    input.estimatorImplementationVersion !==
      ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION ||
    input.classificationPolicyVersion !==
      ADAPTIVE_V2_DIAGNOSTIC_RELEASE.classificationPolicyVersion ||
    input.calibrationPolicyVersion !== ADAPTIVE_V2_CALIBRATION_POLICY_VERSION ||
    input.validationProtocolVersion !==
      ADAPTIVE_V2_DIAGNOSTIC_RELEASE.validationProtocolVersion ||
    input.approvedProbabilityThreshold !==
      ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold
  ) {
    throw new Error('ADAPTIVE_VALIDATION_POLICY_IDENTITY_MISMATCH')
  }
}

async function loadValidationExportRequest(
  requestId: string,
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
): Promise<ValidationExportRequest | null> {
  return prisma.adaptiveCalibrationExportRequest.findUnique({
    where: { id: requestId },
    include: {
      tree: { select: { id: true, ownerId: true, isDeleted: true } },
      scaleVersion: { select: { id: true, treeId: true } },
      requestedBy: { select: { role: true } },
    },
  })
}

function assertValidationExportRequest(
  request: ValidationExportRequest | null,
  input: Parameters<HatchetHandlers['handleAdaptiveEmpiricalValidation']>[0]
): asserts request is ValidationExportRequest {
  if (
    !request ||
    request.status !== DB.AdaptiveCalibrationExportStatus.READY ||
    request.expiresAt <= new Date() ||
    request.treeId !== input.treeId ||
    request.scaleVersionId !== input.scaleVersionId ||
    request.requestedById !== input.submittedById ||
    !request.requestedBy ||
    !hasCurrentAdaptiveCalibrationExportAuthority({
      request,
      actorId: input.submittedById,
      persistedRole: request.requestedBy.role,
    }) ||
    !request.artifactKey ||
    !request.artifactChecksum ||
    !request.manifestArtifactKey ||
    !request.manifestChecksum ||
    !request.holdoutArtifactKey ||
    !request.holdoutArtifactChecksum ||
    (request.holdoutRowCount ?? 0) < 30 ||
    request.criterionArtifactKey !== input.criterionArtifactKey ||
    request.criterionArtifactChecksum !== input.criterionArtifactChecksum ||
    !input.criterionArtifactKey.startsWith(
      `criteria/${input.treeId}/${input.exportRequestId}/`
    )
  ) {
    throw new Error('ADAPTIVE_VALIDATION_EXPORT_NOT_AUTHORIZED')
  }
}

function assertManifestMatchesRequest(
  manifest: z.infer<typeof validationManifestSchema>,
  request: ValidationExportRequest
) {
  if (
    manifest.datasetVersion !== request.datasetVersion ||
    manifest.splitPolicyVersion !== request.splitPolicyVersion ||
    manifest.treeId !== request.treeId ||
    manifest.scaleVersionId !== request.scaleVersionId ||
    manifest.calibration.checksum !== request.artifactChecksum ||
    manifest.calibration.rowCount !== request.rowCount ||
    manifest.holdout.checksum !== request.holdoutArtifactChecksum ||
    manifest.holdout.rowCount !== request.holdoutRowCount
  ) {
    throw new Error('ADAPTIVE_VALIDATION_MANIFEST_IDENTITY_MISMATCH')
  }
}

async function lockValidationEvidenceBoundary(
  tx: DB.Prisma.TransactionClient,
  input: Parameters<HatchetHandlers['handleAdaptiveEmpiricalValidation']>[0]
) {
  const tree = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "CompetenceTree"
    WHERE id = ${input.treeId}::uuid
    FOR SHARE
  `
  const scale = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "CompetenceTreeScaleVersion"
    WHERE id = ${input.scaleVersionId}::uuid
      AND "treeId" = ${input.treeId}::uuid
    FOR SHARE
  `
  const submitter = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "User"
    WHERE id = ${input.submittedById}::uuid
    FOR SHARE
  `
  const request = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "AdaptiveCalibrationExportRequest"
    WHERE id = ${input.exportRequestId}::uuid
    FOR UPDATE
  `
  if (!tree[0] || !scale[0] || !submitter[0] || !request[0]) {
    throw new Error('ADAPTIVE_VALIDATION_EXPORT_NOT_AUTHORIZED')
  }
}

function assertExportEvidenceUnchanged(
  current: ValidationExportRequest,
  original: ValidationExportRequest
) {
  if (
    current.datasetVersion !== original.datasetVersion ||
    current.splitPolicyVersion !== original.splitPolicyVersion ||
    current.artifactKey !== original.artifactKey ||
    current.artifactChecksum !== original.artifactChecksum ||
    current.rowCount !== original.rowCount ||
    current.manifestArtifactKey !== original.manifestArtifactKey ||
    current.manifestChecksum !== original.manifestChecksum ||
    current.holdoutArtifactKey !== original.holdoutArtifactKey ||
    current.holdoutArtifactChecksum !== original.holdoutArtifactChecksum ||
    current.holdoutRowCount !== original.holdoutRowCount
  ) {
    throw new Error('ADAPTIVE_VALIDATION_EXPORT_IDENTITY_CHANGED')
  }
}

async function deletePersistedCriterionArtifact({
  container,
  requestId,
  criterionArtifactKey,
  criterionArtifactChecksum,
  prisma,
}: {
  container: Awaited<ReturnType<typeof getAdaptiveExportContainer>>
  requestId: string
  criterionArtifactKey: string
  criterionArtifactChecksum: string
  prisma: DB.PrismaClient
}) {
  try {
    await container
      .getBlobClient(criterionArtifactKey)
      .deleteIfExists({ deleteSnapshots: 'include' })
  } catch {
    return
  }
  await prisma.adaptiveCalibrationExportRequest.updateMany({
    where: {
      id: requestId,
      criterionArtifactKey,
      criterionArtifactChecksum,
    },
    data: {
      criterionArtifactKey: null,
      criterionArtifactChecksum: null,
    },
  })
}

function toAdaptiveScale(
  scale: DB.CompetenceTreeScaleVersion & {
    levels: DB.CompetenceTreeScaleLevel[]
  }
): AdaptiveScaleDefinition {
  const levels = scale.levels
    .slice()
    .sort((left, right) => left.order - right.order)
  return {
    priorMean: scale.priorMean,
    priorStandardDeviation: scale.priorStandardDeviation,
    gridMin: scale.gridMin,
    gridMax: scale.gridMax,
    gridStep: scale.gridStep,
    classificationPolicyVersion: scale.classificationPolicyVersion,
    levels: levels.map((level, index) => ({
      id: level.id,
      label: level.label,
      order: level.order,
      lowerBound:
        index === 0
          ? Number.NEGATIVE_INFINITY
          : requireFiniteCut(level.lowerBound),
      upperBound:
        index === levels.length - 1
          ? Number.POSITIVE_INFINITY
          : requireFiniteCut(levels[index + 1]!.lowerBound),
      itemDifficultyPrior: level.itemDifficultyPrior,
    })),
  }
}

async function downloadArtifact(
  container: Awaited<ReturnType<typeof getAdaptiveExportContainer>>,
  key: string
) {
  const response = await container.getBlobClient(key).download()
  if (!response.readableStreamBody) {
    throw new Error('ADAPTIVE_VALIDATION_ARTIFACT_EMPTY')
  }
  return response.readableStreamBody as Readable
}

async function downloadVerifiedArtifact({
  stream,
  expectedChecksum,
  maximumBytes,
}: {
  stream: Readable
  expectedChecksum: string
  maximumBytes: number
}) {
  const chunks: Buffer[] = []
  const hash = createHash('sha256')
  let byteCount = 0
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteCount += bytes.length
    if (byteCount > maximumBytes) {
      throw new Error('ADAPTIVE_VALIDATION_ARTIFACT_TOO_LARGE')
    }
    hash.update(bytes)
    chunks.push(bytes)
  }
  if (hash.digest('hex') !== expectedChecksum) {
    throw new Error('ADAPTIVE_VALIDATION_ARTIFACT_CHECKSUM_MISMATCH')
  }
  return Buffer.concat(chunks)
}

async function readVerifiedHoldoutRows({
  stream,
  expectedChecksum,
  add,
}: {
  stream: Readable
  expectedChecksum: string
  add: (row: unknown) => void
}) {
  const hash = createHash('sha256')
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  const lines = createInterface({
    input: stream.pipe(meter).pipe(createGunzip()),
    crlfDelay: Infinity,
  })
  for await (const line of lines) {
    if (line.trim().length > 0) add(JSON.parse(line))
  }
  if (hash.digest('hex') !== expectedChecksum) {
    throw new Error('ADAPTIVE_VALIDATION_ARTIFACT_CHECKSUM_MISMATCH')
  }
}

async function findExistingValidation(
  input: Parameters<HatchetHandlers['handleAdaptiveEmpiricalValidation']>[0],
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
) {
  return prisma.adaptivePracticeQuizEmpiricalValidation.findFirst({
    where: adaptiveValidationEvidenceIdentity(input),
    select: { id: true },
  })
}

export function adaptiveValidationEvidenceIdentity(
  input: Parameters<HatchetHandlers['handleAdaptiveEmpiricalValidation']>[0]
) {
  return {
    configId: input.configId,
    bankFingerprint: input.bankFingerprint,
    configFingerprint: input.configFingerprint,
    scaleVersionId: input.scaleVersionId,
    estimatorImplementationVersion: input.estimatorImplementationVersion,
    classificationPolicyVersion: input.classificationPolicyVersion,
    calibrationPolicyVersion: input.calibrationPolicyVersion,
    validationProtocolVersion: input.validationProtocolVersion,
    approvedProbabilityThreshold: input.approvedProbabilityThreshold,
    exportRequestId: input.exportRequestId,
    criterionArtifactChecksum: input.criterionArtifactChecksum,
  }
}

export function adaptiveValidationArtifactKey(
  input: Parameters<HatchetHandlers['handleAdaptiveEmpiricalValidation']>[0]
) {
  const identityChecksum = checksum(adaptiveValidationEvidenceIdentity(input))
  return `${input.treeId}/${input.exportRequestId}/validation/${identityChecksum}.json`
}

function requireValue<T>(value: T | null): T {
  if (value === null) throw new Error('ADAPTIVE_VALIDATION_EXPORT_INCOMPLETE')
  return value
}

function requireFiniteCut(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    throw new Error('ADAPTIVE_VALIDATION_SCALE_INVALID')
  }
  return value
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex')
}
