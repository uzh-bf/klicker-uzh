import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { AdaptivePracticeQuizConfigInput } from './adaptivePracticeQuizConfigTypes.js'

type AdaptiveSelectionTree = { id: string; ownerId: string }

export const ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION = 'IRT_V2_EAP_GRID_1'
export const ADAPTIVE_V2_CALIBRATION_POLICY_VERSION = 1

export type AdaptiveMeasurementSelection = {
  measurementVersion: DB.AdaptiveMeasurementVersion
  scaleVersionId: string | null
  calibrationPolicyVersion: number | null
}

export async function resolveAdaptiveMeasurementSelection({
  courseId,
  input,
  tree,
  userId,
  prisma,
}: {
  courseId: string
  input: AdaptivePracticeQuizConfigInput
  tree: AdaptiveSelectionTree
  userId: string
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
}): Promise<AdaptiveMeasurementSelection> {
  if (!input.scaleVersionId) {
    return {
      measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
      scaleVersionId: null,
      calibrationPolicyVersion: null,
    }
  }

  assertV2AuthorInput(input)
  const scale = await prisma.competenceTreeScaleVersion.findUnique({
    where: {
      treeId_id: { treeId: tree.id, id: input.scaleVersionId },
    },
    select: {
      id: true,
      status: true,
      classificationPolicyVersion: true,
      _count: { select: { levels: true } },
    },
  })
  if (!scale) {
    throw selectionError(
      'The selected scale does not belong to the competence tree.',
      'ADAPTIVE_V2_SCALE_REQUIRED'
    )
  }
  if (
    scale.status !== DB.AdaptiveScaleVersionStatus.ACTIVE ||
    scale._count.levels < 2 ||
    scale.classificationPolicyVersion !== 1
  ) {
    throw selectionError(
      'The selected scale is not an active, supported adaptive scale.',
      'ADAPTIVE_V2_SCALE_NOT_ACTIVE'
    )
  }

  if (input.preset === DB.AdaptivePracticeQuizPreset.RESEARCH) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { isAdaptiveLearningCalibrationEnabled: true },
    })
    if (
      tree.ownerId !== userId ||
      !course?.isAdaptiveLearningCalibrationEnabled
    ) {
      throw selectionError(
        'Research calibration collection requires tree ownership and the course collection gate.',
        'ADAPTIVE_V2_RESEARCH_DESIGN_DISCONNECTED'
      )
    }
  }

  return {
    measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
    scaleVersionId: scale.id,
    calibrationPolicyVersion: ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
  }
}

function assertV2AuthorInput(input: AdaptivePracticeQuizConfigInput) {
  if (input.preset === DB.AdaptivePracticeQuizPreset.PLACEMENT) {
    throw selectionError(
      'IRT v2 Placement is not available.',
      'ADAPTIVE_V2_PLACEMENT_UNAVAILABLE'
    )
  }
  if (
    input.classificationZ !== null &&
    typeof input.classificationZ !== 'undefined'
  ) {
    throw selectionError(
      'IRT v2 classification policy is server-owned.',
      'ADAPTIVE_V2_CLASSIFICATION_OVERRIDE_FORBIDDEN'
    )
  }
  if (
    input.elementOverrides?.some(
      ({ discrimination }) =>
        discrimination !== null && typeof discrimination !== 'undefined'
    ) ||
    (input.researchSettings?.defaultDiscrimination !== null &&
      typeof input.researchSettings?.defaultDiscrimination !== 'undefined')
  ) {
    throw selectionError(
      'IRT v2 item parameters come from immutable calibrations.',
      'ADAPTIVE_V2_ITEM_PARAMETER_OVERRIDE_FORBIDDEN'
    )
  }
  const requestedRetake = input.researchSettings?.attemptSelectionPolicy
  if (
    requestedRetake &&
    requestedRetake !== DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED
  ) {
    throw selectionError(
      'IRT v2 requires the latest completed attempt policy.',
      'ADAPTIVE_V2_RETAKE_POLICY_INVALID'
    )
  }
}

function selectionError(message: string, code: string) {
  return new GraphQLError(message, { extensions: { code } })
}
