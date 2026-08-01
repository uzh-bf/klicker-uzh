import {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveCalibrationExportStatus,
  AdaptiveEmpiricalValidationStatus,
  AdaptiveEstimateNodeKind,
  AdaptiveItemCalibrationStatus,
  AdaptiveItemModel,
  AdaptiveLevelMappingRule,
  AdaptiveMeasurementVersion,
  AdaptiveNodeKind,
  AdaptivePoolItemRole,
  AdaptivePracticeQuizAttemptStatus,
  AdaptivePracticeQuizPreset,
  AdaptivePracticeQuizStopReason,
  AdaptiveResultStatus,
  ElementStatus,
  ElementType,
  PermissionLevel,
  PracticeQuizMode,
  Prisma,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { getPrisma } from '../global-setup.js'
import { createReviewedActiveScale } from './adaptive-governance-fixtures.js'
import { adaptiveElementData } from './adaptive-release-fixtures.js'
import { COURSE_ID_TEST, USER_ID_TEST, USER_ID_TEST2 } from './constants.js'

const V2_ESTIMATOR_VERSION = 'IRT_V2_EAP_GRID_1'
const V2_CANDIDATE_SET_POLICY_VERSION = 'IRT_V2_TOP_INFORMATION_RANDOMIZED_1'
const V2_RANDOMIZATION_POLICY_VERSION = 'HASH32_JOINT_V1'
const V2_OVERLAP_POLICY_VERSION = 'IRT_V2_FIRST_EXPOSURE_OVERLAP_1'
const V2_STOPPING_POLICY_VERSION = 'IRT_V2_POSTERIOR_BAND_MASS_1'
const V2_RESEARCH_ALLOCATION_VERSION = 'IRT_V2_RESEARCH_ALLOCATION_2'
const V2_RESEARCH_COLLECTION_VERSION = 'IRT_V2_RESEARCH_COLLECTION_1'
const V2_EXPOSURE_CEILING = 0.4
const V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL = 1
const V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF = 1
const V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL = Math.ceil(
  V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL / V2_EXPOSURE_CEILING
)
const V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF = Math.ceil(
  V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF / V2_EXPOSURE_CEILING
)
const V2_RESEARCH_SCORING_REDUNDANCY_PER_LEAF = 1

export type AdaptiveV2ResearchFixture = Awaited<
  ReturnType<typeof createAdaptiveV2ResearchDraftFixture>
>

export type AdaptiveV2ResultFixture = Awaited<
  ReturnType<typeof createAdaptiveV2ResultFixture>
>

export async function createAdaptiveV2ResearchDraftFixture({
  key,
}: {
  key: string
}) {
  return createAdaptiveV2Fixture({
    key,
    preset: AdaptivePracticeQuizPreset.RESEARCH,
    materializePublication: false,
  })
}

export async function createAdaptiveV2ResultFixture({ key }: { key: string }) {
  const fixture = await createAdaptiveV2Fixture({
    key,
    preset: AdaptivePracticeQuizPreset.DIAGNOSTIC,
    materializePublication: true,
  })
  if (!fixture.publication) {
    throw new Error('The adaptive v2 result fixture was not published.')
  }
  return { ...fixture, publication: fixture.publication }
}

async function createAdaptiveV2Fixture({
  key,
  preset,
  materializePublication,
}: {
  key: string
  preset:
    | typeof AdaptivePracticeQuizPreset.RESEARCH
    | typeof AdaptivePracticeQuizPreset.DIAGNOSTIC
  materializePublication: boolean
}) {
  const prisma = await getPrisma()
  await prisma.course.update({
    where: { id: COURSE_ID_TEST },
    data: {
      isAdaptiveLearningEnabled: true,
      isAdaptiveLearningCalibrationEnabled: true,
    },
  })

  return prisma.$transaction(async (tx) => {
    const tree = await tx.competenceTree.create({
      data: {
        name: `adaptive-v2-${key}`,
        displayName: `Adaptive v2 ${key}`,
        description: 'Deterministic adaptive v2 Playwright fixture.',
        ownerId: USER_ID_TEST,
        thetaMin: -3,
        thetaMax: 3,
        maxDepth: 5,
      },
    })
    await tx.competenceTreeCourse.create({
      data: {
        treeId: tree.id,
        courseId: COURSE_ID_TEST,
        linkedById: USER_ID_TEST,
      },
    })
    const levels = await Promise.all(
      ['Foundation', 'Independent', 'Advanced'].map((label, order) =>
        tx.competenceTreeLevel.create({
          data: { treeId: tree.id, label, order },
        })
      )
    )
    const roots = await Promise.all(
      ['Reasoning', 'Communication'].map((name, order) =>
        tx.competenceTreeNode.create({
          data: {
            treeId: tree.id,
            kind: AdaptiveNodeKind.COMPETENCE,
            name,
            order,
            depth: 1,
            weight: 1,
          },
        })
      )
    )
    const leaves = await Promise.all(
      roots.map((root, order) =>
        tx.competenceTreeNode.create({
          data: {
            treeId: tree.id,
            parentId: root.id,
            kind: AdaptiveNodeKind.SUBCOMPETENCE,
            name: order === 0 ? 'Evidence' : 'Clarity',
            order: 0,
            depth: 2,
            weight: 1,
          },
        })
      )
    )
    await tx.competenceTreeLeafLevelCoverage.createMany({
      data: leaves.flatMap((leaf) =>
        levels.map((level) => ({
          treeId: tree.id,
          leafNodeId: leaf.id,
          levelId: level.id,
          targetItemCount: 1,
          enabled: true,
        }))
      ),
    })
    const scale = await createReviewedActiveScale({
      tx,
      treeId: tree.id,
      levels,
      creatorId: USER_ID_TEST,
      reviewerId: USER_ID_TEST2,
      artifactKey: `adaptive-v2-${key}`,
      lowerBounds: [null, -0.75, 0.75],
      itemDifficultyPriors: [-1.5, 0, 1.5],
      gridMin: -4,
      gridMax: 4,
    })
    const quiz = await tx.practiceQuiz.create({
      data: {
        name: `adaptive-v2-quiz-${key}`,
        displayName: `Adaptive v2 quiz ${key}`,
        description: 'Deterministic adaptive v2 Playwright workflow.',
        ownerId: USER_ID_TEST,
        courseId: COURSE_ID_TEST,
        mode: PracticeQuizMode.ADAPTIVE,
        status: materializePublication
          ? PublicationStatus.PUBLISHED
          : PublicationStatus.DRAFT,
        pointsMultiplier: 0,
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
        resetTimeDays: 0,
      },
    })
    await tx.derivedPermission.create({
      data: {
        practiceQuizId: quiz.id,
        userId: USER_ID_TEST,
        permissionLevel: PermissionLevel.OWNER,
      },
    })
    const research = preset === AdaptivePracticeQuizPreset.RESEARCH
    const config = await tx.practiceQuizAdaptiveConfig.create({
      data: {
        practiceQuizId: quiz.id,
        competenceTreeId: tree.id,
        measurementVersion: AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        calibrationPolicyVersion: 1,
        scaleVersionId: scale.id,
        preset,
        attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
        totalQuestionCap: research ? 8 : 6,
        perLeafQuestionCap: research ? 4 : 3,
        minQuestionsPerLeaf: 1,
        classificationZ: 1.28,
        topInformationRatio: 0.8,
        defaultDiscrimination: 1.2,
        levelMappingRule: AdaptiveLevelMappingRule.NEAREST,
        showTimer: false,
      },
    })
    await tx.practiceQuizAdaptiveNodeOverride.createMany({
      data: roots.flatMap((root, index) => [
        {
          configId: config.id,
          competenceTreeId: tree.id,
          nodeId: root.id,
          enabled: true,
          weight: 0.5,
        },
        {
          configId: config.id,
          competenceTreeId: tree.id,
          nodeId: leaves[index]!.id,
          enabled: true,
        },
      ]),
    })

    const calibratedItems = []
    for (const [leafIndex, leaf] of leaves.entries()) {
      const researchScoringItemCount =
        levels.length * V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL +
        V2_RESEARCH_SCORING_REDUNDANCY_PER_LEAF
      const itemsPerLeaf = research
        ? researchScoringItemCount +
          V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF
        : 3
      for (let itemIndex = 0; itemIndex < itemsPerLeaf; itemIndex++) {
        const fieldTest = research && itemIndex >= researchScoringItemCount
        const sourceLevel = levels[itemIndex % levels.length]!
        const element = await tx.element.create({
          data: {
            type: ElementType.SC,
            name: `Adaptive v2 ${key} ${leaf.name} ${itemIndex + 1}`,
            content: `Adaptive v2 ${leaf.name} question ${itemIndex + 1}`,
            explanation: 'Deterministic adaptive v2 test fixture.',
            status: ElementStatus.READY,
            options: {
              hasSampleSolution: true,
              hasAnswerFeedbacks: true,
              displayMode: 'LIST',
              choices: [
                {
                  ix: 0,
                  value: 'Supported answer',
                  correct: true,
                  feedback: 'This response is supported by the evidence.',
                },
                {
                  ix: 1,
                  value: 'Unsupported answer',
                  correct: false,
                  feedback: 'Review the evidence and try a similar item.',
                },
              ],
            },
            ownerId: USER_ID_TEST,
          },
        })
        const assignment = await tx.competenceTreeElementAssignment.create({
          data: {
            treeId: tree.id,
            elementId: element.id,
            leafNodeId: leaf.id,
            levelId: sourceLevel.id,
            enabled: true,
          },
        })
        const difficulty = fieldTest ? 0.25 : [-1.5, 0, 1.5][sourceLevel.order]!
        const calibration = await tx.adaptiveItemCalibration.create({
          data: {
            treeId: tree.id,
            scaleVersionId: scale.id,
            assignmentId: assignment.id,
            elementId: element.id,
            elementVersion: element.version,
            version: 1,
            model: AdaptiveItemModel.THREE_PL_FIXED_C,
            status: fieldTest
              ? AdaptiveItemCalibrationStatus.PILOT
              : AdaptiveItemCalibrationStatus.CALIBRATED,
            discrimination: 1.2,
            difficulty,
            guessing: 0.5,
            parameterUncertainty: {
              discriminationStandardError: 0.05,
              difficultyStandardError: 0.1,
              guessingStandardError: 0.01,
            },
            responseCount: fieldTest ? 20 : 200,
            participantCount: fieldTest ? 20 : 150,
            diagnostics: {
              fitStatus: 'PASS',
              difStatus: 'PASS',
              driftStatus: 'PASS',
              warningCodes: [],
            },
            datasetVersion: 'adaptive-playwright-v2',
            datasetChecksum: String(assignment.id).padStart(64, '0'),
            modelImplementationVersion: 'adaptive-playwright-3pl-v1',
            elementContentChecksum: String(element.id).padStart(64, '0'),
            createdById: USER_ID_TEST,
            approvedById: fieldTest ? null : USER_ID_TEST2,
            approvedAt: fieldTest ? null : new Date('2026-07-01T00:00:00Z'),
          },
        })
        calibratedItems.push({
          root: roots[leafIndex]!,
          leaf,
          sourceLevel,
          element,
          assignment,
          calibration,
        })
      }
    }

    let publication = null
    let poolItems: Awaited<
      ReturnType<typeof tx.practiceQuizAdaptivePoolItem.findMany>
    > = []
    if (materializePublication) {
      const validation = await createApprovedDiagnosticValidation({
        tx,
        key,
        configId: config.id,
        treeId: tree.id,
        scaleVersionId: scale.id,
      })
      publication = await tx.practiceQuizAdaptivePublication.create({
        data: adaptiveV2PublicationData({
          config,
          tree,
          scale,
          roots,
          leaves,
          preset,
          empiricalValidationId: validation.id,
        }),
      })
      for (const item of calibratedItems) {
        const scaleLevel = scale.levels.find(
          ({ sourceLevelId }) => sourceLevelId === item.sourceLevel.id
        )!
        const poolItem = await tx.practiceQuizAdaptivePoolItem.create({
          data: {
            configId: config.id,
            competenceTreeId: tree.id,
            publicationId: publication.id,
            scaleVersionId: scale.id,
            calibrationId: item.calibration.id,
            sourceAssignmentId: item.assignment.id,
            elementId: item.element.id,
            elementVersion: item.element.version,
            elementType: item.element.type,
            elementName: item.element.name,
            elementData: adaptiveElementData(item.element),
            leafNodeId: item.leaf.id,
            nodePath: [item.root.id, item.leaf.id],
            nodeNamePath: [item.root.name, item.leaf.name],
            levelId: scaleLevel.id,
            levelLabel: scaleLevel.label,
            levelOrder: scaleLevel.order,
            discrimination: item.calibration.discrimination,
            difficulty: item.calibration.difficulty,
            guessing: item.calibration.guessing,
            measurementVersion: AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
            calibrationVersion: item.calibration.version,
            calibrationStatus: item.calibration.status,
            itemModel: item.calibration.model,
            modelImplementationVersion:
              item.calibration.modelImplementationVersion,
            role: AdaptivePoolItemRole.SCORING,
            contributesToEstimate: true,
          },
        })
        poolItems.push(poolItem)
      }
      await tx.adaptivePracticeQuizItemExposure.createMany({
        data: poolItems.map((poolItem) => ({
          publicationId: publication!.id,
          poolItemId: poolItem.id,
        })),
      })
      publication = await tx.practiceQuizAdaptivePublication.update({
        where: { id: publication.id },
        data: { sealedAt: new Date() },
      })
      await tx.practiceQuizAdaptiveConfig.update({
        where: { id: config.id },
        data: { poolPublishedAt: new Date() },
      })
    }

    return {
      courseId: COURSE_ID_TEST,
      ownerId: USER_ID_TEST,
      tree,
      levels,
      roots,
      leaves,
      scale,
      quiz,
      config,
      calibratedItems,
      publication,
      poolItems,
    }
  })
}

function adaptiveV2PublicationData({
  config,
  tree,
  scale,
  roots,
  leaves,
  preset,
  empiricalValidationId,
}: {
  config: {
    id: string
    totalQuestionCap: number
    perLeafQuestionCap: number | null
    minQuestionsPerLeaf: number
    classificationZ: number
    topInformationRatio: number
    showTimer: boolean
  }
  tree: { id: string; thetaMin: number; thetaMax: number }
  scale: {
    id: string
    priorMean: number
    priorStandardDeviation: number
    gridMin: number
    gridMax: number
    gridStep: number
    levels: Array<{
      id: number
      sourceLevelId: number | null
      order: number
      label: string
      lowerBound: number | null
      itemDifficultyPrior: number
    }>
  }
  roots: Array<{
    id: number
    name: string
    kind: AdaptiveNodeKind
    depth: number
    order: number
  }>
  leaves: Array<{
    id: number
    name: string
    kind: AdaptiveNodeKind
    depth: number
    order: number
  }>
  preset:
    | typeof AdaptivePracticeQuizPreset.RESEARCH
    | typeof AdaptivePracticeQuizPreset.DIAGNOSTIC
  empiricalValidationId: string | null
}): Prisma.PracticeQuizAdaptivePublicationUncheckedCreateInput {
  const research = preset === AdaptivePracticeQuizPreset.RESEARCH
  const nodes = roots.flatMap((root, index) => [
    {
      nodeId: root.id,
      name: root.name,
      parentId: null,
      kind: root.kind,
      depth: root.depth,
      order: root.order,
      nodePath: [root.id],
      enabled: true,
      normalizedWeight: 0.5,
      effectiveLeafWeight: null,
    },
    {
      nodeId: leaves[index]!.id,
      name: leaves[index]!.name,
      parentId: root.id,
      kind: leaves[index]!.kind,
      depth: leaves[index]!.depth,
      order: leaves[index]!.order,
      nodePath: [root.id, leaves[index]!.id],
      enabled: true,
      normalizedWeight: 1,
      effectiveLeafWeight: 0.5,
    },
  ])
  return {
    version: 1,
    configId: config.id,
    competenceTreeId: tree.id,
    scaleVersionId: scale.id,
    measurementVersion: AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
    preset,
    estimatorImplementationVersion: V2_ESTIMATOR_VERSION,
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
    classificationProbabilityThreshold: 0.8,
    hierarchicalWeightSnapshot: nodes,
    evidenceMinimumSnapshot: {
      minimumResponsesPerLeaf: config.minQuestionsPerLeaf,
      minimumResponsesPerRoot: config.minQuestionsPerLeaf,
      requiredRootIds: roots.map(({ id }) => id),
      classificationZ: config.classificationZ,
      topInformationRatio: config.topInformationRatio,
      levelMappingRule: AdaptiveLevelMappingRule.NEAREST,
      thetaMin: tree.thetaMin,
      thetaMax: tree.thetaMax,
    },
    totalQuestionCap: config.totalQuestionCap,
    showTimer: config.showTimer,
    questionCapSnapshot: {
      root: Object.fromEntries(roots.map(({ id }) => [String(id), null])),
      node: Object.fromEntries(
        [...roots, ...leaves].map(({ id }) => [String(id), null])
      ),
      leaf: Object.fromEntries(
        leaves.map(({ id }) => [String(id), config.perLeafQuestionCap])
      ),
    },
    candidateSetPolicyVersion: V2_CANDIDATE_SET_POLICY_VERSION,
    randomizationPolicyVersion: V2_RANDOMIZATION_POLICY_VERSION,
    exposureCeiling: V2_EXPOSURE_CEILING,
    overlapPolicyVersion: V2_OVERLAP_POLICY_VERSION,
    retakePolicy: AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
    retakeCooldownDays: 0,
    researchAllocationPolicy: research
      ? {
          version: V2_RESEARCH_ALLOCATION_VERSION,
          collectionDesignVersion: V2_RESEARCH_COLLECTION_VERSION,
          anchorProbability: 0.8,
          fieldTestProbability: 0.2,
          minimumAnchorCountPerLeafBand:
            V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL,
          fieldTestResponsesPerLeaf: V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF,
          minimumDistinctAnchorItemsPerLeafBand:
            V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
          minimumDistinctFieldTestItemsPerLeaf:
            V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
          splitPolicyVersion: V2_RANDOMIZATION_POLICY_VERSION,
        }
      : Prisma.JsonNull,
    stoppingPolicyVersion: V2_STOPPING_POLICY_VERSION,
    rolloutPolicyVersion: 1,
    empiricalValidationId,
    publishedById: USER_ID_TEST,
  }
}

async function createApprovedDiagnosticValidation({
  tx,
  key,
  configId,
  treeId,
  scaleVersionId,
}: {
  tx: Prisma.TransactionClient
  key: string
  configId: string
  treeId: string
  scaleVersionId: string
}) {
  const calibrationDatasetChecksum = 'd'.repeat(64)
  const holdoutDatasetChecksum = 'e'.repeat(64)
  const criterionArtifactChecksum = '2'.repeat(64)
  const exportRequest = await tx.adaptiveCalibrationExportRequest.create({
    data: {
      status: AdaptiveCalibrationExportStatus.READY,
      datasetVersion: `playwright-calibration-${key}`,
      splitPolicyVersion: 'HMAC_80_20_V1',
      treeId,
      scaleVersionId,
      requestedById: USER_ID_TEST,
      artifactKey: `test/playwright/${key}/calibration.ndjson`,
      artifactChecksum: calibrationDatasetChecksum,
      rowCount: 100,
      manifestArtifactKey: `test/playwright/${key}/manifest.json`,
      manifestChecksum: '3'.repeat(64),
      holdoutArtifactKey: `test/playwright/${key}/holdout.ndjson`,
      holdoutArtifactChecksum: holdoutDatasetChecksum,
      holdoutRowCount: 40,
      completedAt: new Date('2026-07-03T00:00:00.000Z'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    },
  })
  await tx.adaptiveCalibrationExportRequest.update({
    where: { id: exportRequest.id },
    data: {
      criterionArtifactKey: `criteria/${treeId}/${exportRequest.id}/criterion.json`,
      criterionArtifactChecksum,
    },
  })
  const validation = await tx.adaptivePracticeQuizEmpiricalValidation.create({
    data: {
      configId,
      competenceTreeId: treeId,
      scaleVersionId,
      exportRequestId: exportRequest.id,
      bankFingerprint: 'b'.repeat(64),
      configFingerprint: 'c'.repeat(64),
      measurementVersion: AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
      estimatorImplementationVersion: V2_ESTIMATOR_VERSION,
      classificationPolicyVersion: 1,
      calibrationPolicyVersion: 1,
      validationProtocolVersion: 'diagnostic-protocol-v1',
      approvedProbabilityThreshold: 0.8,
      calibrationDatasetVersion: `playwright-calibration-${key}`,
      calibrationDatasetChecksum,
      holdoutDatasetVersion: `playwright-holdout-${key}`,
      holdoutDatasetChecksum,
      disjointSplitProofChecksum: 'f'.repeat(64),
      criterionArtifactChecksum,
      aggregateMetrics: {
        fixture: true,
        exactAgreementInterval: { lower: 1, upper: 1 },
      },
      stratumMetrics: [],
      artifactChecksum: '1'.repeat(64),
      artifactKey: `test/playwright/${key}/holdout-validation.json`,
      submittedById: USER_ID_TEST,
    },
  })
  return tx.adaptivePracticeQuizEmpiricalValidation.update({
    where: { id: validation.id },
    data: {
      status: AdaptiveEmpiricalValidationStatus.APPROVED,
      approvedById: USER_ID_TEST2,
      reviewedAt: new Date('2026-07-04T00:00:00.000Z'),
    },
  })
}

export async function seedAdaptiveV2CompletedAttempts({
  fixture,
  results,
}: {
  fixture: {
    courseId: string
    tree: { id: string }
    quiz: { id: string }
    config: { id: string }
    scale: {
      id: string
      levels: Array<{
        id: number
        sourceLevelId: number | null
        order: number
      }>
    }
    roots: Array<{ id: number; kind: AdaptiveNodeKind }>
    leaves: Array<{ id: number; kind: AdaptiveNodeKind }>
  }
  results: Array<{
    participantUsername: string
    status: AdaptiveResultStatus
  }>
}) {
  const prisma = await getPrisma()
  const publication =
    await prisma.practiceQuizAdaptivePublication.findFirstOrThrow({
      where: {
        configId: fixture.config.id,
        sealedAt: { not: null },
        supersededAt: null,
        unpublishedAt: null,
      },
      orderBy: { version: 'desc' },
    })
  const poolItems = await prisma.practiceQuizAdaptivePoolItem.findMany({
    where: { publicationId: publication.id },
    orderBy: { id: 'asc' },
  })
  if (poolItems.length < 4) {
    throw new Error('Adaptive v2 result fixtures require at least four items.')
  }
  const participants = await prisma.participant.findMany({
    where: {
      username: {
        in: results.map(({ participantUsername }) => participantUsername),
      },
    },
    select: { id: true, username: true },
  })
  const participantByUsername = new Map(
    participants.map((participant) => [participant.username, participant])
  )
  const participations = await prisma.participation.findMany({
    where: {
      courseId: fixture.courseId,
      participantId: { in: participants.map(({ id }) => id) },
    },
    select: { id: true, participantId: true },
  })
  const participationByParticipant = new Map(
    participations.map((participation) => [
      participation.participantId,
      participation,
    ])
  )
  const scaleLevels = fixture.scale.levels
    .slice()
    .sort((left, right) => left.order - right.order)
  const sourceLevel = scaleLevels[0]!
  if (sourceLevel.sourceLevelId === null) {
    throw new Error('Adaptive v2 result fixture scale levels must be mapped.')
  }
  const nodes = [...fixture.roots, ...fixture.leaves]

  for (const [resultIndex, result] of results.entries()) {
    const participant = participantByUsername.get(result.participantUsername)
    const participation = participant
      ? participationByParticipant.get(participant.id)
      : null
    if (!participant || !participation) {
      throw new Error(
        `Participant ${result.participantUsername} must be enrolled in the adaptive fixture course.`
      )
    }
    const view = adaptiveV2ResultView(result.status, scaleLevels)
    const responseItems = poolItems
    const completedAt = new Date(Date.UTC(2026, 6, 25, 12, resultIndex, 30))
    const firstPoolItem = responseItems[0]!

    await prisma.$transaction(async (tx) => {
      const attempt = await tx.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.config.id,
          competenceTreeId: fixture.tree.id,
          publicationId: publication.id,
          scaleVersionId: publication.scaleVersionId,
          measurementVersion: publication.measurementVersion,
          estimatorImplementationVersion:
            publication.estimatorImplementationVersion,
          classificationPolicyVersion: publication.classificationPolicyVersion,
          calibrationPolicyVersion: publication.calibrationPolicyVersion,
          practiceQuizId: fixture.quiz.id,
          courseId: fixture.courseId,
          participantId: participant.id,
          participationId: participation.id,
          status: AdaptivePracticeQuizAttemptStatus.IN_PROGRESS,
          nextPoolItemId: firstPoolItem.id,
          nextAdministrationProbability: 1,
          nextCollectionDesignVersion: null,
          nextRandomizationVersion: V2_RANDOMIZATION_POLICY_VERSION,
          nextRandomDraw: BigInt(1),
          nextCandidateSetHash: String(1).padStart(64, '0'),
          nextItemRole: firstPoolItem.role,
          startedAt: new Date(completedAt.getTime() - 90_000),
        },
      })

      for (const [index, poolItem] of responseItems.entries()) {
        const randomDraw = BigInt(index + 1)
        const candidateSetHash = String(index + 1).padStart(64, '0')
        if (index > 0) {
          await tx.adaptivePracticeQuizAttempt.update({
            where: { id: attempt.id },
            data: {
              nextPoolItemId: poolItem.id,
              nextAdministrationProbability: 1,
              nextCollectionDesignVersion: null,
              nextRandomizationVersion: V2_RANDOMIZATION_POLICY_VERSION,
              nextRandomDraw: randomDraw,
              nextCandidateSetHash: candidateSetHash,
              nextItemRole: poolItem.role,
            },
          })
        }
        await tx.adaptivePracticeQuizResponse.create({
          data: {
            attemptId: attempt.id,
            configId: fixture.config.id,
            publicationId: publication.id,
            assignmentId: poolItem.sourceAssignmentId,
            poolItemId: poolItem.id,
            elementId: poolItem.elementId,
            elementSnapshot: poolItem.elementData as Prisma.InputJsonValue,
            order: index + 1,
            response: { choiceIndices: [0] },
            normalizedResponse: { choiceIndices: [0] },
            score: 1,
            correct: true,
            overallThetaBefore: index === 0 ? 0 : view.theta,
            overallThetaAfter: view.theta,
            overallStandardErrorAfter: 0.35,
            overallCredibleLowerAfter: view.credibleLower,
            overallCredibleUpperAfter: view.credibleUpper,
            overallBandProbabilitiesAfter: view.bandProbabilities,
            administrationProbability: 1,
            randomizationVersion: V2_RANDOMIZATION_POLICY_VERSION,
            randomDraw,
            candidateSetHash,
            collectionDesignVersion: null,
            itemRole: poolItem.role,
            isCalibrationAnchor: poolItem.role === AdaptivePoolItemRole.ANCHOR,
            elapsedSeconds: 20,
          },
        })
      }

      await tx.adaptivePracticeQuizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason: view.stopReason,
          resultStatus: result.status,
          currentTheta: view.theta,
          currentStandardError: 0.35,
          finalTheta: view.theta,
          finalStandardError: 0.35,
          finalLevelId:
            result.status === AdaptiveResultStatus.CLASSIFIED
              ? sourceLevel.sourceLevelId
              : null,
          finalScaleLevelId:
            result.status === AdaptiveResultStatus.CLASSIFIED
              ? sourceLevel.id
              : null,
          finalBandProbability: view.classificationProbability,
          credibleLower: view.credibleLower,
          credibleUpper: view.credibleUpper,
          bandProbabilities: view.bandProbabilities,
          elapsedSeconds: 90 + resultIndex,
          nextPoolItemId: null,
          nextAdministrationProbability: null,
          nextCollectionDesignVersion: null,
          nextRandomizationVersion: null,
          nextRandomDraw: null,
          nextCandidateSetHash: null,
          nextItemRole: null,
          completedAt,
        },
      })
      await tx.adaptivePracticeQuizEstimate.createMany({
        data: [
          {
            attemptId: attempt.id,
            configId: fixture.config.id,
            competenceTreeId: fixture.tree.id,
            nodeKind: AdaptiveEstimateNodeKind.OVERALL,
            nodeId: null,
          },
          ...nodes.map((node) => ({
            attemptId: attempt.id,
            configId: fixture.config.id,
            competenceTreeId: fixture.tree.id,
            nodeKind:
              node.kind === AdaptiveNodeKind.COMPETENCE
                ? AdaptiveEstimateNodeKind.COMPETENCE
                : AdaptiveEstimateNodeKind.SUBCOMPETENCE,
            nodeId: node.id,
          })),
        ].map((estimate) => ({
          ...estimate,
          theta: view.theta,
          standardError: 0.35,
          responseCount: responseItems.length,
          levelId:
            result.status === AdaptiveResultStatus.CLASSIFIED
              ? sourceLevel.sourceLevelId
              : null,
          stopReason: view.stopReason,
          resultStatus: result.status,
          classificationProbability: view.classificationProbability,
          credibleLower: view.credibleLower,
          credibleUpper: view.credibleUpper,
          bandProbabilities: view.bandProbabilities,
        })),
      })
    })
  }
}

function adaptiveV2ResultView(
  status: AdaptiveResultStatus,
  levels: Array<{ id: number; order: number }>
) {
  const probabilities = (values: number[]) =>
    Object.fromEntries(levels.map((level, index) => [level.id, values[index]]))
  switch (status) {
    case AdaptiveResultStatus.CLASSIFIED:
      return {
        theta: -1.5,
        credibleLower: -2,
        credibleUpper: -1,
        classificationProbability: 0.9,
        bandProbabilities: probabilities([0.9, 0.08, 0.02]),
        stopReason: AdaptivePracticeQuizStopReason.CLASSIFIED,
      }
    case AdaptiveResultStatus.BETWEEN_LEVELS:
      return {
        theta: -0.75,
        credibleLower: -1.1,
        credibleUpper: -0.4,
        classificationProbability: 0.9,
        bandProbabilities: probabilities([0.45, 0.45, 0.1]),
        stopReason: AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
      }
    case AdaptiveResultStatus.INSUFFICIENT_EVIDENCE:
      return {
        theta: 0,
        credibleLower: -2,
        credibleUpper: 2,
        classificationProbability: null,
        bandProbabilities: probabilities([0.3, 0.4, 0.3]),
        stopReason: AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA,
      }
    case AdaptiveResultStatus.POOL_LIMITED:
      return {
        theta: 1,
        credibleLower: -0.5,
        credibleUpper: 2,
        classificationProbability: null,
        bandProbabilities: probabilities([0.1, 0.35, 0.55]),
        stopReason: AdaptivePracticeQuizStopReason.POOL_EXHAUSTED,
      }
    case AdaptiveResultStatus.RESEARCH_ONLY:
      return {
        theta: 0,
        credibleLower: -1,
        credibleUpper: 1,
        classificationProbability: null,
        bandProbabilities: probabilities([0.25, 0.5, 0.25]),
        stopReason: AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP,
      }
  }
}
