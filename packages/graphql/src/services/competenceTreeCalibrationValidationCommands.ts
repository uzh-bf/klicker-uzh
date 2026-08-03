import { ADAPTIVE_V2_DIAGNOSTIC_RELEASE } from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import type { AdaptiveEmpiricalValidationTaskInput } from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import {
  ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
  ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
} from './adaptivePracticeQuizV2Selection.js'
import { parseAdaptiveEmpiricalValidationRequest } from './competenceTreeCalibrationArtifact.js'
import {
  assertScaleIdentity,
  parseArtifact,
} from './competenceTreeCalibrationCommandUtils.js'
import {
  assertAdaptiveReviewer,
  calibrationServiceError,
  calibrationTransaction,
  lockEmpiricalValidation,
  lockOwnedCalibrationTree,
  lockScaleVersion,
} from './competenceTreeCalibrationRepository.js'
import { resolveAdaptiveValidationCandidate } from './competenceTreeCalibrationValidationCandidate.js'

export async function submitAdaptiveEmpiricalValidation(
  artifactInput: unknown,
  ctx: ContextWithUser
) {
  const requestInput = parseArtifact(
    artifactInput,
    parseAdaptiveEmpiricalValidationRequest,
    'ADAPTIVE_EMPIRICAL_VALIDATION_REQUEST_INVALID'
  )
  const payload = await calibrationTransaction(ctx, async (tx) => {
    await lockOwnedCalibrationTree(tx, requestInput.treeId, ctx)
    const scale = await lockScaleVersion(tx, requestInput.scaleVersionId)
    assertScaleIdentity(scale, requestInput.treeId)
    const candidate = await resolveAdaptiveValidationCandidate({
      configId: requestInput.configId,
      treeId: requestInput.treeId,
      scaleVersionId: requestInput.scaleVersionId,
      prisma: tx,
    })
    if (
      ADAPTIVE_V2_DIAGNOSTIC_RELEASE.validationProtocolVersion === null ||
      ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold === null
    ) {
      throw calibrationServiceError(
        'No empirical validation protocol is currently approved.',
        'ADAPTIVE_V2_VALIDATION_PROTOCOL_UNAVAILABLE'
      )
    }
    if (
      candidate.scale.classificationPolicyVersion !==
        ADAPTIVE_V2_DIAGNOSTIC_RELEASE.classificationPolicyVersion ||
      candidate.config.calibrationPolicyVersion !==
        ADAPTIVE_V2_CALIBRATION_POLICY_VERSION
    ) {
      throw calibrationServiceError(
        'The validation policy identity does not match the release manifest.',
        'ADAPTIVE_VALIDATION_POLICY_IDENTITY_MISMATCH'
      )
    }

    const exportRequest = await tx.adaptiveCalibrationExportRequest.findUnique({
      where: { id: requestInput.exportRequestId },
    })
    if (
      !exportRequest ||
      exportRequest.requestedById !== ctx.user.sub ||
      exportRequest.treeId !== requestInput.treeId ||
      exportRequest.scaleVersionId !== requestInput.scaleVersionId ||
      exportRequest.status !== DB.AdaptiveCalibrationExportStatus.READY ||
      exportRequest.expiresAt <= new Date() ||
      !exportRequest.artifactChecksum ||
      !exportRequest.manifestChecksum ||
      !exportRequest.holdoutArtifactChecksum ||
      (exportRequest.holdoutRowCount ?? 0) < 30 ||
      (exportRequest.criterionArtifactKey !== null &&
        exportRequest.criterionArtifactKey !==
          requestInput.criterionArtifactKey) ||
      (exportRequest.criterionArtifactChecksum !== null &&
        exportRequest.criterionArtifactChecksum !==
          requestInput.criterionArtifactChecksum) ||
      !requestInput.criterionArtifactKey.startsWith(
        `criteria/${requestInput.treeId}/${requestInput.exportRequestId}/`
      )
    ) {
      throw calibrationServiceError(
        'The sealed validation export is not available.',
        'ADAPTIVE_VALIDATION_EXPORT_NOT_AVAILABLE'
      )
    }

    const persistedCriterion =
      await tx.adaptiveCalibrationExportRequest.updateMany({
        where: {
          id: exportRequest.id,
          status: DB.AdaptiveCalibrationExportStatus.READY,
          expiresAt: { gt: new Date() },
        },
        data: {
          criterionArtifactKey: requestInput.criterionArtifactKey,
          criterionArtifactChecksum: requestInput.criterionArtifactChecksum,
        },
      })
    if (persistedCriterion.count !== 1) {
      throw calibrationServiceError(
        'The sealed validation export is no longer available.',
        'ADAPTIVE_VALIDATION_EXPORT_NOT_AVAILABLE'
      )
    }

    return {
      exportRequestId: requestInput.exportRequestId,
      configId: requestInput.configId,
      treeId: requestInput.treeId,
      scaleVersionId: requestInput.scaleVersionId,
      criterionArtifactKey: requestInput.criterionArtifactKey,
      criterionArtifactChecksum: requestInput.criterionArtifactChecksum,
      submittedById: ctx.user.sub,
      bankFingerprint: candidate.bankFingerprint,
      configFingerprint: candidate.configFingerprint,
      measurementVersion: 'IRT_V2_EAP_GRID_1',
      estimatorImplementationVersion:
        ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
      classificationPolicyVersion:
        ADAPTIVE_V2_DIAGNOSTIC_RELEASE.classificationPolicyVersion,
      calibrationPolicyVersion: ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
      validationProtocolVersion:
        ADAPTIVE_V2_DIAGNOSTIC_RELEASE.validationProtocolVersion,
      approvedProbabilityThreshold:
        ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold,
    } satisfies AdaptiveEmpiricalValidationTaskInput
  })

  try {
    await ctx.tasks.adaptiveEmpiricalValidation.runNoWait([payload])
  } catch {
    throw calibrationServiceError(
      'The empirical validation could not be queued.',
      'ADAPTIVE_VALIDATION_ENQUEUE_FAILED'
    )
  }
  return { id: requestInput.exportRequestId, status: 'QUEUED' }
}

export async function reviewAdaptiveEmpiricalValidation(
  {
    validationId,
    decision,
  }: {
    validationId: string
    decision: 'APPROVED' | 'REJECTED'
  },
  ctx: ContextWithUser
) {
  return calibrationTransaction(ctx, async (tx) => {
    await assertAdaptiveReviewer(tx, ctx)
    const validation = await lockEmpiricalValidation(tx, validationId)
    if (validation.submittedById === ctx.user.sub) {
      throw calibrationServiceError(
        'A validation submitter cannot approve their own evidence.',
        'ADAPTIVE_INDEPENDENT_REVIEW_REQUIRED'
      )
    }
    if (validation.status !== DB.AdaptiveEmpiricalValidationStatus.SUBMITTED) {
      throw calibrationServiceError(
        'The empirical validation is not awaiting review.',
        'ADAPTIVE_VALIDATION_NOT_SUBMITTED'
      )
    }
    return tx.adaptivePracticeQuizEmpiricalValidation.update({
      where: { id: validation.id },
      data: {
        status:
          decision === 'APPROVED'
            ? DB.AdaptiveEmpiricalValidationStatus.APPROVED
            : DB.AdaptiveEmpiricalValidationStatus.REJECTED,
        approvedById: ctx.user.sub,
        reviewedAt: new Date(),
      },
    })
  })
}

export async function setCourseAdaptiveCalibrationCollectionEnabled(
  {
    courseId,
    enabled,
  }: {
    courseId: string
    enabled: boolean
  },
  ctx: ContextWithUser
) {
  return calibrationTransaction(ctx, async (tx) => {
    await assertAdaptiveReviewer(tx, ctx)
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Course" WHERE id = ${courseId}::uuid FOR UPDATE
    `
    if (!rows[0]) {
      throw calibrationServiceError('Course not found.', 'NOT_FOUND')
    }
    return tx.course.update({
      where: { id: courseId },
      data: { isAdaptiveLearningCalibrationEnabled: enabled },
    })
  })
}
