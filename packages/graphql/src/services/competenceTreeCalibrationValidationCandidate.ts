import * as DB from '@klicker-uzh/prisma/client'
import {
  adaptiveConfigInclude,
  prepareStoredConfiguration,
} from './adaptivePracticeQuizConfigPreparation.js'
import { resolveAdaptiveSourceElementAvailability } from './adaptivePracticeQuizPublicationAuthorization.js'
import { buildAdaptiveV2ConfigFingerprint } from './adaptivePracticeQuizV2Fingerprint.js'
import { assessAdaptiveV2Readiness } from './adaptivePracticeQuizV2Readiness.js'
import { calibrationServiceError } from './competenceTreeCalibrationRepository.js'

export async function resolveAdaptiveValidationCandidate({
  configId,
  treeId,
  scaleVersionId,
  prisma,
}: {
  configId: string
  treeId: string
  scaleVersionId: string
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
}) {
  const config = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { id: configId },
    include: {
      ...adaptiveConfigInclude,
      practiceQuiz: { select: { courseId: true } },
    },
  })
  if (!config || config.competenceTreeId !== treeId) {
    throw calibrationServiceError(
      'Adaptive configuration not found.',
      'NOT_FOUND'
    )
  }
  if (
    config.measurementVersion !==
      DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1 ||
    config.scaleVersionId !== scaleVersionId ||
    config.preset !== DB.AdaptivePracticeQuizPreset.DIAGNOSTIC
  ) {
    throw calibrationServiceError(
      'Empirical validation requires a Diagnostic IRT v2 candidate configuration.',
      'ADAPTIVE_VALIDATION_CONFIG_REQUIRED'
    )
  }

  const availability = await resolveAdaptiveSourceElementAvailability({
    ownerId: config.competenceTree.ownerId,
    elements: config.competenceTree.elementAssignments.map(
      ({ elementId, element }) => ({
        id: elementId,
        isDeleted: element.isDeleted,
      })
    ),
    prisma,
  })
  const prepared = prepareStoredConfiguration(config, availability)
  const assessment = await assessAdaptiveV2Readiness({
    configId: config.id,
    courseId: config.practiceQuiz.courseId,
    scaleVersionId,
    preset: config.preset,
    prepared,
    prisma,
  })
  if (
    !prepared.readiness.ready ||
    assessment.calibrations.length === 0 ||
    assessment.calibrations.some(
      ({ calibration, role }) =>
        !calibration ||
        role !== DB.AdaptivePoolItemRole.SCORING ||
        calibration.status !== DB.AdaptiveItemCalibrationStatus.CALIBRATED
    )
  ) {
    throw calibrationServiceError(
      'The validation candidate does not have a complete calibrated bank.',
      'ADAPTIVE_VALIDATION_CALIBRATED_BANK_REQUIRED'
    )
  }
  if (
    assessment.scale.status !== DB.AdaptiveScaleVersionStatus.APPROVED &&
    assessment.scale.status !== DB.AdaptiveScaleVersionStatus.ACTIVE
  ) {
    throw calibrationServiceError(
      'Empirical validation requires an approved scale.',
      'ADAPTIVE_VALIDATION_SCALE_NOT_APPROVED'
    )
  }

  const configFingerprint = buildAdaptiveV2ConfigFingerprint({
    config,
    prepared,
    scale: assessment.scale,
    bankFingerprint: assessment.bankFingerprint,
  })
  return {
    config,
    prepared,
    scale: assessment.scale,
    calibrations: assessment.calibrations.map(({ calibration }) =>
      requireCalibration(calibration)
    ),
    bankFingerprint: assessment.bankFingerprint,
    configFingerprint,
  }
}

function requireCalibration(calibration: DB.AdaptiveItemCalibration | null) {
  if (!calibration) {
    throw calibrationServiceError(
      'The validation candidate does not have a complete calibrated bank.',
      'ADAPTIVE_VALIDATION_CALIBRATED_BANK_REQUIRED'
    )
  }
  return calibration
}
