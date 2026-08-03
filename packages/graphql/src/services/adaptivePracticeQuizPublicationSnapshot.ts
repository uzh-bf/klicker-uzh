import {
  ADAPTIVE_CLASSIFICATION_POLICY_V1,
  ADAPTIVE_V2_DIAGNOSTIC_RELEASE,
  ADAPTIVE_V2_RANDOMIZATION_VERSION,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import {
  adaptiveServiceError,
  mapTreeLevels,
  type AdaptiveConfigRecord,
  type PreparedAdaptiveConfiguration,
} from './adaptivePracticeQuizConfigPreparation.js'
import {
  ADAPTIVE_V2_CANDIDATE_SET_POLICY_VERSION,
  ADAPTIVE_V2_EXPOSURE_CEILING,
  ADAPTIVE_V2_OVERLAP_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_ALLOCATION_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_COLLECTION_VERSION,
  ADAPTIVE_V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
  ADAPTIVE_V2_STOPPING_POLICY_VERSION,
} from './adaptivePracticeQuizEstimatorVersions.js'
import { buildAdaptiveV2ConfigFingerprint } from './adaptivePracticeQuizV2Fingerprint.js'
import { assessAdaptiveV2Readiness } from './adaptivePracticeQuizV2Readiness.js'
import {
  ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
  ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
} from './adaptivePracticeQuizV2Selection.js'

const LEGACY_CALIBRATION_DATASET_VERSION = 'legacy-author-prior-v1'
const LEGACY_CALIBRATION_MODEL_VERSION = 'irt-v1-author-prior'
const LEGACY_ESTIMATOR_VERSION = 'irt-v1-legacy'

export type AdaptivePublicationCalibration = {
  assignmentId: number
  calibration: DB.AdaptiveItemCalibration
  role: DB.AdaptivePoolItemRole
  contributesToEstimate: boolean
}

export async function prepareAdaptivePublicationSnapshot({
  config,
  prepared,
  publishedById,
  publicationVersion,
  retakeCooldownDays,
  prisma,
}: {
  config: AdaptiveConfigRecord
  prepared: PreparedAdaptiveConfiguration
  publishedById: string
  publicationVersion: number
  retakeCooldownDays: number
  prisma: DB.Prisma.TransactionClient
}) {
  if (
    config.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    return prepareAdaptiveV2PublicationSnapshot({
      config,
      prepared,
      publishedById,
      publicationVersion,
      retakeCooldownDays,
      prisma,
    })
  }

  const scale = await ensureLegacyScaleVersion({ config, prepared, prisma })
  const calibrations = await ensureLegacyCalibrations({
    config,
    prepared,
    scaleVersionId: scale.id,
    createdById: publishedById,
    prisma,
  })

  return {
    scale,
    calibrations,
    publicationData: {
      version: publicationVersion,
      configId: config.id,
      competenceTreeId: config.competenceTreeId,
      scaleVersionId: scale.id,
      measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
      preset: config.preset,
      estimatorImplementationVersion: LEGACY_ESTIMATOR_VERSION,
      classificationPolicyVersion: 1,
      calibrationPolicyVersion: 1,
      cutScoreSnapshot: scale.levels.map((level) => ({
        scaleLevelId: level.id,
        sourceLevelId: level.sourceLevelId,
        order: level.order,
        label: level.label,
        lowerBound: level.lowerBound,
        itemDifficultyPrior: level.itemDifficultyPrior,
      })),
      priorMean: scale.priorMean,
      priorStandardDeviation: scale.priorStandardDeviation,
      gridMin: scale.gridMin,
      gridMax: scale.gridMax,
      gridStep: scale.gridStep,
      classificationProbabilityThreshold: null,
      hierarchicalWeightSnapshot: buildWeightSnapshot(prepared),
      evidenceMinimumSnapshot: buildEvidenceMinimumSnapshot(prepared),
      totalQuestionCap: config.totalQuestionCap,
      showTimer: config.showTimer,
      questionCapSnapshot: buildQuestionCapSnapshot(prepared),
      candidateSetPolicyVersion: 'irt-v1-max-information',
      randomizationPolicyVersion: 'irt-v1-deterministic',
      exposureCeiling: 1,
      overlapPolicyVersion: 'irt-v1-no-exposure-control',
      retakePolicy: config.attemptSelectionPolicy,
      retakeCooldownDays,
      researchAllocationPolicy: DB.Prisma.JsonNull,
      stoppingPolicyVersion: 'irt-v1-z-interval',
      rolloutPolicyVersion: 1,
      publishedById,
    } satisfies DB.Prisma.PracticeQuizAdaptivePublicationUncheckedCreateInput,
  }
}

async function ensureLegacyScaleVersion({
  config,
  prepared,
  prisma,
}: {
  config: AdaptiveConfigRecord
  prepared: PreparedAdaptiveConfiguration
  prisma: DB.Prisma.TransactionClient
}) {
  if (config.scaleVersionId) {
    const selected = await prisma.competenceTreeScaleVersion.findUnique({
      where: {
        treeId_id: {
          treeId: config.competenceTreeId,
          id: config.scaleVersionId,
        },
      },
      include: { levels: { orderBy: { order: 'asc' } } },
    })
    if (selected) return selected
  }

  const existing = await prisma.competenceTreeScaleVersion.findFirst({
    where: {
      treeId: config.competenceTreeId,
      calibrations: {
        some: { datasetVersion: LEGACY_CALIBRATION_DATASET_VERSION },
      },
    },
    include: { levels: { orderBy: { order: 'asc' } } },
    orderBy: { version: 'asc' },
  })
  if (existing) {
    await bindLegacyScaleToConfig(config.id, existing.id, prisma)
    return existing
  }

  const latest = await prisma.competenceTreeScaleVersion.aggregate({
    where: { treeId: config.competenceTreeId },
    _max: { version: true },
  })
  const mappedLevels = mapTreeLevels(prepared.tree, config.levelMappingRule)
  const scale = await prisma.competenceTreeScaleVersion.create({
    data: {
      treeId: config.competenceTreeId,
      version: (latest._max.version ?? 0) + 1,
      status: DB.AdaptiveScaleVersionStatus.DRAFT,
      priorMean: 0,
      priorStandardDeviation: 1,
      gridMin: Math.min(-6, prepared.tree.thetaMin),
      gridMax: Math.max(6, prepared.tree.thetaMax),
      gridStep: 0.1,
      classificationPolicyVersion: 1,
      createdById: prepared.tree.ownerId,
      levels: {
        create: mappedLevels.map((level) => ({
          sourceLevelId: level.id,
          order: level.order,
          label: level.label,
          lowerBound: level.order === 0 ? null : level.lowerBound,
          itemDifficultyPrior: level.theta,
        })),
      },
    },
    include: { levels: { orderBy: { order: 'asc' } } },
  })
  await bindLegacyScaleToConfig(config.id, scale.id, prisma)
  return scale
}

async function bindLegacyScaleToConfig(
  configId: string,
  scaleVersionId: string,
  prisma: DB.Prisma.TransactionClient
) {
  await prisma.practiceQuizAdaptiveConfig.update({
    where: { id: configId },
    data: {
      scaleVersionId,
      measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
      calibrationPolicyVersion: 1,
    },
  })
}

async function ensureLegacyCalibrations({
  config,
  prepared,
  scaleVersionId,
  createdById,
  prisma,
}: {
  config: AdaptiveConfigRecord
  prepared: PreparedAdaptiveConfiguration
  scaleVersionId: string
  createdById: string
  prisma: DB.Prisma.TransactionClient
}): Promise<AdaptivePublicationCalibration[]> {
  const assignments = prepared.assignments.filter(
    (assignment) => assignment.enabled && assignment.available
  )
  const existing = await prisma.adaptiveItemCalibration.findMany({
    where: {
      treeId: config.competenceTreeId,
      scaleVersionId,
      datasetVersion: LEGACY_CALIBRATION_DATASET_VERSION,
      OR: assignments.map((assignment) => ({
        assignmentId: assignment.id,
        elementId: assignment.elementId,
        elementVersion: assignment.elementVersion,
      })),
    },
    orderBy: { version: 'desc' },
  })
  const byAssignment = new Map<number, DB.AdaptiveItemCalibration>()
  for (const calibration of existing) {
    const assignment = assignments.find(
      ({ id }) => id === calibration.assignmentId
    )
    if (
      assignment &&
      !byAssignment.has(calibration.assignmentId) &&
      matchesLegacyCalibration(assignment, calibration)
    ) {
      byAssignment.set(calibration.assignmentId, calibration)
    }
  }

  for (const assignment of assignments) {
    if (byAssignment.has(assignment.id)) continue
    const latest = await prisma.adaptiveItemCalibration.aggregate({
      where: {
        treeId: config.competenceTreeId,
        scaleVersionId,
        assignmentId: assignment.id,
        elementId: assignment.elementId,
        elementVersion: assignment.elementVersion,
      },
      _max: { version: true },
    })
    const calibration = await prisma.adaptiveItemCalibration.create({
      data: {
        treeId: config.competenceTreeId,
        scaleVersionId,
        assignmentId: assignment.id,
        elementId: assignment.elementId,
        elementVersion: assignment.elementVersion,
        version: (latest._max.version ?? 0) + 1,
        model: isTwoParameterItem(assignment.elementType)
          ? DB.AdaptiveItemModel.TWO_PL
          : DB.AdaptiveItemModel.THREE_PL_FIXED_C,
        status: DB.AdaptiveItemCalibrationStatus.PROVISIONAL,
        discrimination: assignment.discrimination,
        difficulty: assignment.difficulty,
        guessing: assignment.guessing,
        parameterUncertainty: {
          discriminationStandardError: null,
          difficultyStandardError: null,
          guessingStandardError: null,
          discriminationInterval: null,
          difficultyInterval: null,
          guessingInterval: null,
        },
        responseCount: 0,
        participantCount: 0,
        diagnostics: {
          fitStatus: 'WARN',
          difStatus: 'WARN',
          driftStatus: 'WARN',
          fitStatistics: {},
          warningCodes: ['LEGACY_AUTHOR_PRIOR_NOT_EMPIRICALLY_CALIBRATED'],
          dif: {},
          drift: {},
        },
        datasetVersion: LEGACY_CALIBRATION_DATASET_VERSION,
        datasetChecksum: checksum({
          treeId: config.competenceTreeId,
          assignmentId: assignment.id,
          elementVersion: assignment.elementVersion,
        }),
        modelImplementationVersion: LEGACY_CALIBRATION_MODEL_VERSION,
        elementContentChecksum: checksum({
          elementId: assignment.elementId,
          elementVersion: assignment.elementVersion,
          content: assignment.element.content,
          options: assignment.element.options,
        }),
        createdById,
      },
    })
    byAssignment.set(assignment.id, calibration)
  }

  return assignments.map((assignment) => ({
    assignmentId: assignment.id,
    calibration: byAssignment.get(assignment.id)!,
    role: DB.AdaptivePoolItemRole.SCORING,
    contributesToEstimate: true,
  }))
}

async function prepareAdaptiveV2PublicationSnapshot({
  config,
  prepared,
  publishedById,
  publicationVersion,
  retakeCooldownDays,
  prisma,
}: {
  config: AdaptiveConfigRecord
  prepared: PreparedAdaptiveConfiguration
  publishedById: string
  publicationVersion: number
  retakeCooldownDays: number
  prisma: DB.Prisma.TransactionClient
}) {
  if (!config.scaleVersionId) {
    throw adaptiveServiceError(
      'IRT v2 publication requires an active scale.',
      'ADAPTIVE_V2_SCALE_REQUIRED'
    )
  }
  const quiz = await prisma.practiceQuiz.findUniqueOrThrow({
    where: { id: config.practiceQuizId },
    select: { courseId: true },
  })
  await prisma.$queryRaw`
    SELECT id FROM "CompetenceTreeScaleVersion"
    WHERE id = ${config.scaleVersionId}::uuid
      AND "treeId" = ${config.competenceTreeId}::uuid
    FOR SHARE
  `
  await prisma.$queryRaw`
    SELECT id FROM "AdaptiveItemCalibration"
    WHERE "treeId" = ${config.competenceTreeId}::uuid
      AND "scaleVersionId" = ${config.scaleVersionId}::uuid
    ORDER BY id
    FOR SHARE
  `
  const assessment = await assessAdaptiveV2Readiness({
    configId: config.id,
    courseId: quiz.courseId,
    scaleVersionId: config.scaleVersionId,
    preset: config.preset,
    prepared,
    prisma,
  })
  const configFingerprint = buildAdaptiveV2ConfigFingerprint({
    config,
    prepared,
    scale: assessment.scale,
    bankFingerprint: assessment.bankFingerprint,
  })
  if (assessment.empiricalValidationId) {
    const validation = await prisma.$queryRaw<
      Array<{
        status: DB.AdaptiveEmpiricalValidationStatus
        bankFingerprint: string
        configFingerprint: string
      }>
    >`
      SELECT status, "bankFingerprint", "configFingerprint"
      FROM "AdaptivePracticeQuizEmpiricalValidation"
      WHERE id = ${assessment.empiricalValidationId}::uuid
      FOR SHARE
    `
    if (
      validation[0]?.status !== DB.AdaptiveEmpiricalValidationStatus.APPROVED ||
      validation[0].bankFingerprint !== assessment.bankFingerprint ||
      validation[0].configFingerprint !== configFingerprint
    ) {
      throw adaptiveServiceError(
        'The approved empirical validation is stale.',
        'ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE'
      )
    }
  }
  if (!assessment.readiness.ready) {
    throw adaptiveServiceError(
      'The calibrated adaptive bank is not ready to publish.',
      'ADAPTIVE_QUIZ_NOT_READY'
    )
  }

  const calibrations = assessment.calibrations.flatMap((entry) =>
    entry.calibration && entry.role
      ? [
          {
            assignmentId: entry.assignmentId,
            calibration: entry.calibration,
            role: entry.role,
            contributesToEstimate: entry.contributesToEstimate,
          },
        ]
      : []
  )
  const researchAllocationPolicy =
    config.preset === DB.AdaptivePracticeQuizPreset.RESEARCH
      ? {
          version: ADAPTIVE_V2_RESEARCH_ALLOCATION_POLICY_VERSION,
          collectionDesignVersion: ADAPTIVE_V2_RESEARCH_COLLECTION_VERSION,
          anchorProbability: 0.8,
          fieldTestProbability: 0.2,
          minimumAnchorCountPerLeafBand:
            ADAPTIVE_V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL,
          fieldTestResponsesPerLeaf:
            ADAPTIVE_V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF,
          minimumDistinctAnchorItemsPerLeafBand:
            ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
          minimumDistinctFieldTestItemsPerLeaf:
            ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
          splitPolicyVersion: ADAPTIVE_V2_RANDOMIZATION_VERSION,
        }
      : DB.Prisma.JsonNull
  const classificationProbabilityThreshold =
    config.preset === DB.AdaptivePracticeQuizPreset.DIAGNOSTIC
      ? ADAPTIVE_V2_DIAGNOSTIC_RELEASE.approvedProbabilityThreshold
      : ADAPTIVE_CLASSIFICATION_POLICY_V1.minimumProbabilityThreshold
  if (classificationProbabilityThreshold === null) {
    throw adaptiveServiceError(
      'IRT v2 Diagnostic publication is disabled until a probability threshold is approved.',
      'ADAPTIVE_V2_DIAGNOSTIC_RELEASE_DISABLED'
    )
  }

  return {
    scale: assessment.scale,
    calibrations,
    publicationData: {
      version: publicationVersion,
      configId: config.id,
      competenceTreeId: config.competenceTreeId,
      scaleVersionId: assessment.scale.id,
      measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
      preset: config.preset,
      estimatorImplementationVersion:
        ADAPTIVE_V2_ESTIMATOR_IMPLEMENTATION_VERSION,
      classificationPolicyVersion: ADAPTIVE_CLASSIFICATION_POLICY_V1.version,
      calibrationPolicyVersion: ADAPTIVE_V2_CALIBRATION_POLICY_VERSION,
      cutScoreSnapshot: assessment.scale.levels.map((level) => ({
        scaleLevelId: level.id,
        sourceLevelId: level.sourceLevelId,
        order: level.order,
        label: level.label,
        lowerBound: level.lowerBound,
        itemDifficultyPrior: level.itemDifficultyPrior,
      })),
      priorMean: assessment.scale.priorMean,
      priorStandardDeviation: assessment.scale.priorStandardDeviation,
      gridMin: assessment.scale.gridMin,
      gridMax: assessment.scale.gridMax,
      gridStep: assessment.scale.gridStep,
      classificationProbabilityThreshold,
      hierarchicalWeightSnapshot: buildWeightSnapshot(prepared),
      evidenceMinimumSnapshot: buildEvidenceMinimumSnapshot(prepared),
      totalQuestionCap: config.totalQuestionCap,
      showTimer: config.showTimer,
      questionCapSnapshot: buildQuestionCapSnapshot(prepared),
      candidateSetPolicyVersion: ADAPTIVE_V2_CANDIDATE_SET_POLICY_VERSION,
      randomizationPolicyVersion: ADAPTIVE_V2_RANDOMIZATION_VERSION,
      exposureCeiling: ADAPTIVE_V2_EXPOSURE_CEILING,
      overlapPolicyVersion: ADAPTIVE_V2_OVERLAP_POLICY_VERSION,
      retakePolicy: DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
      retakeCooldownDays,
      researchAllocationPolicy,
      stoppingPolicyVersion: ADAPTIVE_V2_STOPPING_POLICY_VERSION,
      rolloutPolicyVersion: 1,
      empiricalValidationId: assessment.empiricalValidationId,
      publishedById,
    } satisfies DB.Prisma.PracticeQuizAdaptivePublicationUncheckedCreateInput,
  }
}

function matchesLegacyCalibration(
  assignment: PreparedAdaptiveConfiguration['assignments'][number],
  calibration: DB.AdaptiveItemCalibration
) {
  return (
    calibration.model ===
      (isTwoParameterItem(assignment.elementType)
        ? DB.AdaptiveItemModel.TWO_PL
        : DB.AdaptiveItemModel.THREE_PL_FIXED_C) &&
    calibration.discrimination === assignment.discrimination &&
    calibration.difficulty === assignment.difficulty &&
    calibration.guessing === assignment.guessing &&
    calibration.elementContentChecksum ===
      checksum({
        elementId: assignment.elementId,
        elementVersion: assignment.elementVersion,
        content: assignment.element.content,
        options: assignment.element.options,
      })
  )
}

function buildWeightSnapshot(
  prepared: PreparedAdaptiveConfiguration
): PrismaJson.PrismaAdaptiveHierarchicalWeightSnapshot {
  const nodesById = new Map(prepared.nodes.map((node) => [node.id, node]))
  const childrenByParent = new Map<number | null, typeof prepared.nodes>()
  for (const node of prepared.nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? []
    siblings.push(node)
    childrenByParent.set(node.parentId, siblings)
  }
  const snapshot: PrismaJson.PrismaAdaptiveHierarchicalWeightSnapshot = []

  function visit(
    nodeId: number,
    path: number[],
    parentEffectiveWeight: number
  ) {
    const node = nodesById.get(nodeId)!
    const siblings = (childrenByParent.get(node.parentId) ?? []).filter(
      ({ enabled }) => enabled
    )
    const rawWeight =
      node.weight ??
      prepared.tree.nodes.find(({ id }) => id === node.id)!.weight
    const total = siblings.reduce((sum, sibling) => {
      const siblingWeight =
        sibling.weight ??
        prepared.tree.nodes.find(({ id }) => id === sibling.id)!.weight
      return sum + siblingWeight
    }, 0)
    const normalizedWeight = node.enabled && total > 0 ? rawWeight / total : 0
    const effectiveWeight = parentEffectiveWeight * normalizedWeight
    const childNodes = childrenByParent.get(node.id) ?? []
    snapshot.push({
      nodeId: node.id,
      name: prepared.tree.nodes.find(({ id }) => id === node.id)!.name,
      parentId: node.parentId,
      kind: node.kind,
      depth: node.depth,
      order: node.order,
      nodePath: [...path, node.id],
      enabled: node.enabled,
      normalizedWeight,
      effectiveLeafWeight:
        childNodes.length === 0 && node.enabled ? effectiveWeight : null,
    })
    for (const child of childNodes) {
      visit(child.id, [...path, node.id], effectiveWeight)
    }
  }

  for (const root of childrenByParent.get(null) ?? []) {
    visit(root.id, [], 1)
  }
  return snapshot
}

function buildEvidenceMinimumSnapshot(
  prepared: PreparedAdaptiveConfiguration
): PrismaJson.PrismaAdaptiveEvidenceMinimumSnapshot {
  return {
    minimumResponsesPerLeaf: prepared.config.minQuestionsPerLeaf,
    minimumResponsesPerRoot: prepared.config.minQuestionsPerLeaf,
    requiredRootIds: prepared.nodes
      .filter((node) => node.parentId === null && node.enabled)
      .map(({ id }) => id),
    classificationZ: prepared.config.classificationZ,
    topInformationRatio: prepared.config.topInformationRatio,
    levelMappingRule: prepared.config.levelMappingRule,
    thetaMin: prepared.tree.thetaMin,
    thetaMax: prepared.tree.thetaMax,
  }
}

function buildQuestionCapSnapshot(
  prepared: PreparedAdaptiveConfiguration
): PrismaJson.PrismaAdaptiveQuestionCapSnapshot {
  const root: Record<string, number | null> = {}
  const node: Record<string, number | null> = {}
  const leaf: Record<string, number | null> = {}
  const parentIds = new Set(
    prepared.nodes.flatMap(({ parentId }) =>
      parentId === null ? [] : [parentId]
    )
  )
  for (const entry of prepared.nodes) {
    node[String(entry.id)] = entry.questionCap
    if (entry.parentId === null) root[String(entry.id)] = entry.questionCap
    if (!parentIds.has(entry.id)) {
      leaf[String(entry.id)] = prepared.config.perLeafQuestionCap
    }
  }
  return { root, node, leaf }
}

function isTwoParameterItem(type: DB.ElementType) {
  return type === DB.ElementType.NUMERICAL || type === DB.ElementType.FREE_TEXT
}

function checksum(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
