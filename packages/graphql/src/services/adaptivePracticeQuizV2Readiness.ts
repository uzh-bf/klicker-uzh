import { information } from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ADAPTIVE_V2_DIAGNOSTIC_RELEASE,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
  ADAPTIVE_V2_RESEARCH_SCORING_REDUNDANCY_PER_LEAF,
} from './adaptivePracticeQuizEstimatorIdentity.js'
import {
  ADAPTIVE_PUBLICATION_BLOCKING_WARNING_CODES,
  type AdaptiveQuizReadiness,
  type AdaptiveReadinessIssue,
} from './adaptivePracticeQuizReadiness.js'
import { buildAdaptiveV2ConfigFingerprint } from './adaptivePracticeQuizV2Fingerprint.js'
import {
  ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
  ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
} from './adaptivePracticeQuizV2Selection.js'
import { checksum } from './competenceTreeCalibrationCommandUtils.js'

const RESEARCH_NON_BLOCKING_WARNING_CODES = new Set([
  'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
])

type PreparedV2ReadinessInput = {
  tree: { id: string }
  nodes: Array<{
    id: number
    parentId: number | null
    enabled: boolean
    weight: number | null
    questionCap: number | null
  }>
  coverages: Array<{
    id: number
    leafNodeId: number
    levelId: number
    targetItemCount: number
    enabled: boolean
  }>
  assignments: Array<{
    id: number
    elementId: number
    elementName: string
    elementVersion: number
    leafNodeId: number
    levelId: number
    enabled: boolean
    available: boolean
    controlledAnswerReady: boolean
  }>
  readiness: AdaptiveQuizReadiness
}

export type AdaptiveV2CalibrationResolution = {
  assignmentId: number
  calibration: DB.AdaptiveItemCalibration | null
  role: DB.AdaptivePoolItemRole | null
  contributesToEstimate: boolean
}

export type AdaptiveV2ReadinessAssessment = {
  readiness: AdaptiveQuizReadiness
  scale: DB.CompetenceTreeScaleVersion & {
    levels: DB.CompetenceTreeScaleLevel[]
  }
  calibrations: AdaptiveV2CalibrationResolution[]
  bankFingerprint: string
  empiricalValidationId: string | null
}

export async function assessAdaptiveV2Readiness({
  configId,
  courseId,
  scaleVersionId,
  preset,
  prepared,
  prisma,
}: {
  configId: string | null
  courseId: string
  scaleVersionId: string
  preset: DB.AdaptivePracticeQuizPreset
  prepared: PreparedV2ReadinessInput
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
}): Promise<AdaptiveV2ReadinessAssessment> {
  const errors = [...prepared.readiness.errors]
  const warnings = [...prepared.readiness.warnings]
  const scale = await prisma.competenceTreeScaleVersion.findUnique({
    where: {
      treeId_id: { treeId: prepared.tree.id, id: scaleVersionId },
    },
    include: { levels: { orderBy: { order: 'asc' } } },
  })
  if (!scale) {
    throw new Error('Persisted adaptive v2 scale identity is invalid.')
  }
  if (
    scale.status !== DB.AdaptiveScaleVersionStatus.ACTIVE ||
    scale.levels.length < 2 ||
    scale.classificationPolicyVersion !== 1
  ) {
    errors.push(
      issue(
        'ADAPTIVE_V2_SCALE_NOT_ACTIVE',
        'The selected scale is no longer active or supported.',
        { scaleVersionId }
      )
    )
  }
  if (preset === DB.AdaptivePracticeQuizPreset.PLACEMENT) {
    errors.push(
      issue(
        'ADAPTIVE_V2_PLACEMENT_UNAVAILABLE',
        'IRT v2 Placement is not available.',
        { scaleVersionId }
      )
    )
  }

  const enabledAssignments = prepared.assignments.filter(
    ({ enabled, available, controlledAnswerReady }) =>
      enabled && available && controlledAnswerReady
  )
  const assignmentIds = enabledAssignments.map(({ id }) => id)
  const records =
    assignmentIds.length === 0
      ? []
      : await prisma.adaptiveItemCalibration.findMany({
          where: {
            treeId: prepared.tree.id,
            scaleVersionId,
            assignmentId: { in: assignmentIds },
          },
          orderBy: [{ assignmentId: 'asc' }, { version: 'desc' }],
        })
  const recordsByAssignment = new Map<number, DB.AdaptiveItemCalibration[]>()
  for (const record of records) {
    const values = recordsByAssignment.get(record.assignmentId) ?? []
    values.push(record)
    recordsByAssignment.set(record.assignmentId, values)
  }

  const calibrations = enabledAssignments.map((assignment) => {
    const candidates = recordsByAssignment.get(assignment.id) ?? []
    const calibration = candidates.find(
      (candidate) =>
        candidate.elementId === assignment.elementId &&
        candidate.elementVersion === assignment.elementVersion
    )
    if (!calibration) {
      errors.push(
        issue(
          candidates.length > 0
            ? 'ADAPTIVE_V2_CALIBRATION_VERSION_MISMATCH'
            : 'ADAPTIVE_V2_CALIBRATION_MISSING',
          candidates.length > 0
            ? `Element ${assignment.elementName} changed after its calibration.`
            : `Element ${assignment.elementName} has no calibration for the selected scale.`,
          {
            assignmentId: assignment.id,
            elementName: assignment.elementName,
            elementVersion: assignment.elementVersion,
          },
          assignment.id
        )
      )
      return {
        assignmentId: assignment.id,
        calibration: null,
        role: null,
        contributesToEstimate: false,
      }
    }

    if (
      calibration.status === DB.AdaptiveItemCalibrationStatus.FLAGGED ||
      calibration.status === DB.AdaptiveItemCalibrationStatus.RETIRED
    ) {
      errors.push(
        issue(
          'ADAPTIVE_V2_CALIBRATION_FLAGGED',
          `Element ${assignment.elementName} has been excluded by calibration review.`,
          {
            assignmentId: assignment.id,
            elementName: assignment.elementName,
            calibrationStatus: calibration.status,
          },
          assignment.id
        )
      )
      return {
        assignmentId: assignment.id,
        calibration,
        role: null,
        contributesToEstimate: false,
      }
    }

    if (preset === DB.AdaptivePracticeQuizPreset.DIAGNOSTIC) {
      if (calibration.status !== DB.AdaptiveItemCalibrationStatus.CALIBRATED) {
        errors.push(
          issue(
            'ADAPTIVE_V2_CALIBRATION_MISSING',
            `Element ${assignment.elementName} is not approved for Diagnostic scoring.`,
            {
              assignmentId: assignment.id,
              elementName: assignment.elementName,
              calibrationStatus: calibration.status,
            },
            assignment.id
          )
        )
      }
      return {
        assignmentId: assignment.id,
        calibration,
        role: DB.AdaptivePoolItemRole.SCORING,
        contributesToEstimate: true,
      }
    }

    const isAnchor =
      calibration.status === DB.AdaptiveItemCalibrationStatus.CALIBRATED
    return {
      assignmentId: assignment.id,
      calibration,
      role: isAnchor
        ? DB.AdaptivePoolItemRole.ANCHOR
        : DB.AdaptivePoolItemRole.FIELD_TEST,
      contributesToEstimate: isAnchor,
    }
  })

  if (preset === DB.AdaptivePracticeQuizPreset.RESEARCH) {
    await appendResearchReadiness({
      courseId,
      prepared,
      scale,
      calibrations,
      errors,
      prisma,
    })
  } else if (preset === DB.AdaptivePracticeQuizPreset.DIAGNOSTIC) {
    appendDiagnosticInformationReadiness({
      scale,
      calibrations,
      errors,
    })
  }

  const bankFingerprint = checksum(
    calibrations
      .filter(
        (
          entry
        ): entry is AdaptiveV2CalibrationResolution & {
          calibration: DB.AdaptiveItemCalibration
          role: DB.AdaptivePoolItemRole
        } => entry.calibration !== null && entry.role !== null
      )
      .map((entry) => ({
        assignmentId: entry.assignmentId,
        elementId: entry.calibration.elementId,
        elementVersion: entry.calibration.elementVersion,
        calibrationId: entry.calibration.id,
        calibrationVersion: entry.calibration.version,
        model: entry.calibration.model,
        a: entry.calibration.discrimination,
        b: entry.calibration.difficulty,
        c: entry.calibration.guessing,
        role: entry.role,
        contributesToEstimate: entry.contributesToEstimate,
      }))
  )
  const empiricalValidationId =
    preset === DB.AdaptivePracticeQuizPreset.DIAGNOSTIC && configId
      ? await appendEmpiricalValidationReadiness({
          configId,
          scaleVersionId,
          bankFingerprint,
          prepared,
          scale,
          errors,
          prisma,
        })
      : null

  if (
    preset === DB.AdaptivePracticeQuizPreset.DIAGNOSTIC &&
    (!ADAPTIVE_V2_DIAGNOSTIC_RELEASE.enabled ||
      ADAPTIVE_V2_DIAGNOSTIC_RELEASE.validationProtocolVersion === null ||
      ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold === null)
  ) {
    errors.push(
      issue(
        'ADAPTIVE_V2_EMPIRICAL_VALIDATION_FAILED',
        'IRT v2 Diagnostic release remains disabled because no internally evaluated classification threshold has passed all release gates.',
        { scaleVersionId }
      )
    )
  }

  const baseReadinessReady =
    preset === DB.AdaptivePracticeQuizPreset.RESEARCH
      ? prepared.readiness.errors.length === 0 &&
        !prepared.readiness.warnings.some(
          ({ code }) =>
            ADAPTIVE_PUBLICATION_BLOCKING_WARNING_CODES.has(code) &&
            !RESEARCH_NON_BLOCKING_WARNING_CODES.has(code)
        )
      : prepared.readiness.ready

  return {
    readiness: {
      ...prepared.readiness,
      ready: baseReadinessReady && errors.length === 0,
      errors,
      warnings,
    },
    scale,
    calibrations,
    bankFingerprint,
    empiricalValidationId,
  }
}

async function appendResearchReadiness({
  courseId,
  prepared,
  scale,
  calibrations,
  errors,
  prisma,
}: {
  courseId: string
  prepared: PreparedV2ReadinessInput
  scale: AdaptiveV2ReadinessAssessment['scale']
  calibrations: AdaptiveV2CalibrationResolution[]
  errors: AdaptiveReadinessIssue[]
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
}) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isAdaptiveLearningCalibrationEnabled: true },
  })
  if (!course?.isAdaptiveLearningCalibrationEnabled) {
    errors.push(
      issue(
        'ADAPTIVE_V2_RESEARCH_DESIGN_DISCONNECTED',
        'The course calibration-collection gate is disabled.',
        { scaleVersionId: scale.id }
      )
    )
  }

  const byAssignment = new Map(
    calibrations.map((entry) => [entry.assignmentId, entry])
  )
  const enabledLeafIds = new Set(
    prepared.coverages
      .filter(({ enabled }) => enabled)
      .map(({ leafNodeId }) => leafNodeId)
  )
  for (const leafNodeId of enabledLeafIds) {
    for (const level of scale.levels) {
      const anchorCount = prepared.assignments.filter(
        (assignment) =>
          assignment.enabled &&
          assignment.leafNodeId === leafNodeId &&
          assignment.levelId === level.sourceLevelId &&
          byAssignment.get(assignment.id)?.role ===
            DB.AdaptivePoolItemRole.ANCHOR
      ).length
      if (
        anchorCount <
        ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL
      ) {
        errors.push({
          ...issue(
            'ADAPTIVE_V2_RESEARCH_ANCHORS_REQUIRED',
            'Every enabled leaf and scale band needs enough distinct calibrated anchors for exposure control.',
            {
              scaleVersionId: scale.id,
              requiredQuestionCount:
                ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
              availableItemCount: anchorCount,
            }
          ),
          leafNodeId,
          levelId: level.sourceLevelId ?? undefined,
        })
      }
    }

    const leafCalibrations = prepared.assignments.flatMap((assignment) => {
      const calibration = byAssignment.get(assignment.id)
      return assignment.enabled &&
        assignment.leafNodeId === leafNodeId &&
        calibration
        ? [calibration]
        : []
    })
    const fieldTestCount = leafCalibrations.filter(
      ({ role }) => role === DB.AdaptivePoolItemRole.FIELD_TEST
    ).length
    const scoringCount = leafCalibrations.filter(
      ({ role, contributesToEstimate }) =>
        contributesToEstimate &&
        (role === DB.AdaptivePoolItemRole.ANCHOR ||
          role === DB.AdaptivePoolItemRole.SCORING)
    ).length
    const requiredScoringCount =
      ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL *
        scale.levels.length +
      ADAPTIVE_V2_RESEARCH_SCORING_REDUNDANCY_PER_LEAF
    if (
      fieldTestCount <
        ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF ||
      scoringCount < requiredScoringCount
    ) {
      errors.push({
        ...issue(
          'ADAPTIVE_RESEARCH_FIELD_TEST_COVERAGE_INVALID',
          'Research pools require enough field-test and scoring items for the collection design.',
          {
            scaleVersionId: scale.id,
            requiredQuestionCount:
              requiredScoringCount +
              ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
            availableItemCount: leafCalibrations.length,
          }
        ),
        leafNodeId,
      })
    }
  }
}

function appendDiagnosticInformationReadiness({
  scale,
  calibrations,
  errors,
}: {
  scale: AdaptiveV2ReadinessAssessment['scale']
  calibrations: AdaptiveV2CalibrationResolution[]
  errors: AdaptiveReadinessIssue[]
}) {
  const scoring = calibrations
    .filter(({ contributesToEstimate }) => contributesToEstimate)
    .flatMap(({ calibration }) => (calibration ? [calibration] : []))
  for (const level of scale.levels.slice(1)) {
    const cut = level.lowerBound
    if (cut === null) continue
    const maximumInformation = scoring.reduce(
      (maximum, calibration) =>
        Math.max(
          maximum,
          information(cut, {
            a: calibration.discrimination,
            b: calibration.difficulty,
            c: calibration.guessing,
          })
        ),
      0
    )
    if (maximumInformation < 0.05) {
      errors.push(
        issue(
          'ADAPTIVE_V2_INFORMATION_GAP',
          `The calibrated bank has insufficient information near cut ${cut}.`,
          { scaleVersionId: scale.id }
        )
      )
    }
    if (!scoring.some(({ difficulty }) => Math.abs(difficulty - cut) <= 1.5)) {
      errors.push(
        issue(
          'ADAPTIVE_V2_CUT_SCORE_UNREACHABLE',
          `The calibrated bank does not cover cut ${cut}.`,
          { scaleVersionId: scale.id }
        )
      )
    }
  }
}

async function appendEmpiricalValidationReadiness({
  configId,
  scaleVersionId,
  bankFingerprint,
  prepared,
  scale,
  errors,
  prisma,
}: {
  configId: string
  scaleVersionId: string
  bankFingerprint: string
  prepared: PreparedV2ReadinessInput
  scale: AdaptiveV2ReadinessAssessment['scale']
  errors: AdaptiveReadinessIssue[]
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
}) {
  const validationProtocolVersion =
    ADAPTIVE_V2_DIAGNOSTIC_RELEASE.validationProtocolVersion
  const approvedProbabilityThreshold =
    ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold
  if (
    validationProtocolVersion === null ||
    approvedProbabilityThreshold === null
  ) {
    return null
  }

  const config = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { id: configId },
    select: {
      id: true,
      competenceTreeId: true,
      scaleVersionId: true,
      measurementVersion: true,
      calibrationPolicyVersion: true,
      preset: true,
      attemptSelectionPolicy: true,
      totalQuestionCap: true,
      perLeafQuestionCap: true,
      minQuestionsPerLeaf: true,
    },
  })
  if (!config) {
    errors.push(
      issue(
        'ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE',
        'The approved validation does not match the current adaptive configuration.',
        { scaleVersionId }
      )
    )
    return null
  }
  const configFingerprint = buildAdaptiveV2ConfigFingerprint({
    config,
    prepared,
    scale,
    bankFingerprint,
  })
  const validations =
    await prisma.adaptivePracticeQuizEmpiricalValidation.findMany({
      where: {
        configId,
        scaleVersionId,
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        estimatorImplementationVersion:
          ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
        classificationPolicyVersion:
          ADAPTIVE_V2_DIAGNOSTIC_RELEASE.classificationPolicyVersion,
        calibrationPolicyVersion: ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
        validationProtocolVersion,
        approvedProbabilityThreshold,
      },
      orderBy: { createdAt: 'desc' },
    })
  const approved = validations.find(
    ({ status }) => status === DB.AdaptiveEmpiricalValidationStatus.APPROVED
  )
  if (!approved) {
    errors.push(
      issue(
        validations.some(
          ({ status }) =>
            status === DB.AdaptiveEmpiricalValidationStatus.REJECTED
        )
          ? 'ADAPTIVE_V2_EMPIRICAL_VALIDATION_FAILED'
          : 'ADAPTIVE_V2_EMPIRICAL_VALIDATION_REQUIRED',
        'Diagnostic publication requires independently approved holdout validation.',
        { scaleVersionId }
      )
    )
    return null
  }
  if (
    approved.bankFingerprint !== bankFingerprint ||
    approved.configFingerprint !== configFingerprint
  ) {
    errors.push(
      issue(
        'ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE',
        'The approved validation does not match the current calibrated bank or adaptive configuration.',
        { scaleVersionId }
      )
    )
    return null
  }
  return approved.id
}

function issue(
  code: string,
  message: string,
  parameters: AdaptiveReadinessIssue['parameters'],
  assignmentId?: number
): AdaptiveReadinessIssue {
  return {
    code,
    message,
    parameters,
    path: assignmentId ? `assignments.${assignmentId}` : 'scaleVersionId',
    assignmentId,
  }
}
