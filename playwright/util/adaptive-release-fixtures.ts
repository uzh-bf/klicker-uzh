import {
  AdaptiveAttemptSelectionPolicy,
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
  CourseAuthType,
  ElementStatus,
  ElementType,
  PermissionLevel,
  PracticeQuizMode,
  Prisma,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { getPrisma } from '../global-setup.js'
import { createReviewedActiveScale } from './adaptive-governance-fixtures.js'
import {
  COURSE_ID_TEST,
  PARTICIPANT_IDS,
  USER_ID_TEST,
  USER_ID_TEST2,
} from './constants.js'

export const ADAPTIVE_RELEASE_ELEMENT_TYPES = [
  ElementType.SC,
  ElementType.MC,
  ElementType.KPRIM,
  ElementType.NUMERICAL,
  ElementType.FREE_TEXT,
] as const

export type AdaptiveReleaseFixture = Awaited<
  ReturnType<typeof createAdaptiveReleaseFixture>
>

export async function createAdaptiveReleaseCourse({
  key,
  ownerId,
}: {
  key: string
  ownerId: string
}) {
  const prisma = await getPrisma()
  const course = await prisma.course.create({
    data: {
      name: `adaptive-release-course-${key}`,
      displayName: `Adaptive release course ${key}`,
      description: 'Isolated adaptive Playwright permission boundary.',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2036-12-31T23:59:59.000Z'),
      groupDeadlineDate: new Date('2026-01-02T00:00:00.000Z'),
      authType: CourseAuthType.SSO,
      isAdaptiveLearningEnabled: true,
      ownerId,
    },
  })
  await prisma.derivedPermission.create({
    data: {
      courseId: course.id,
      userId: ownerId,
      permissionLevel: PermissionLevel.OWNER,
    },
  })
  return course
}

export async function createAdaptiveReleaseFixture({
  key,
  courseId = COURSE_ID_TEST,
  ownerId = USER_ID_TEST,
  elementTypes = [ElementType.SC],
  preset = AdaptivePracticeQuizPreset.DIAGNOSTIC,
}: {
  key: string
  courseId?: string
  ownerId?: string
  elementTypes?: readonly ElementType[]
  preset?: AdaptivePracticeQuizPreset
}) {
  if (elementTypes.length === 0) {
    throw new Error('Adaptive release fixtures require at least one element.')
  }

  const prisma = await getPrisma()
  const placement = preset === AdaptivePracticeQuizPreset.PLACEMENT
  const levelMappingRule = placement
    ? AdaptiveLevelMappingRule.MASTERY
    : AdaptiveLevelMappingRule.NEAREST
  const attemptSelectionPolicy = placement
    ? AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
    : AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED
  await prisma.course.update({
    where: { id: courseId },
    data: { isAdaptiveLearningEnabled: true },
  })

  return await prisma.$transaction(async (tx) => {
    const tree = await tx.competenceTree.create({
      data: {
        name: `adaptive-release-tree-${key}`,
        displayName: `Adaptive release tree ${key}`,
        description: 'Isolated adaptive Playwright release fixture.',
        ownerId,
        thetaMin: -3,
        thetaMax: 3,
        maxDepth: 5,
        defaultDiscrimination: 1.2,
        levelMappingRule,
      },
    })
    await tx.competenceTreeCourse.create({
      data: { treeId: tree.id, courseId, linkedById: ownerId },
    })

    const levels = await Promise.all(
      ['Foundation', 'Independent', 'Advanced'].map((label, order) =>
        tx.competenceTreeLevel.create({
          data: { treeId: tree.id, label, order },
        })
      )
    )
    const root = await tx.competenceTreeNode.create({
      data: {
        treeId: tree.id,
        kind: AdaptiveNodeKind.COMPETENCE,
        name: 'Adaptive release competence',
        order: 0,
        depth: 1,
        weight: 1,
      },
    })
    const leaf = await tx.competenceTreeNode.create({
      data: {
        treeId: tree.id,
        parentId: root.id,
        kind: AdaptiveNodeKind.SUBCOMPETENCE,
        name: 'Adaptive release subcompetence',
        order: 0,
        depth: 2,
        weight: 1,
      },
    })
    await tx.competenceTreeLeafLevelCoverage.createMany({
      data: levels.map((level) => ({
        treeId: tree.id,
        leafNodeId: leaf.id,
        levelId: level.id,
        targetItemCount: Math.max(1, elementTypes.length),
        enabled: true,
      })),
    })

    const quiz = await tx.practiceQuiz.create({
      data: {
        name: `adaptive-release-quiz-${key}`,
        displayName: `Adaptive release quiz ${key}`,
        description: 'Adaptive release Playwright workflow.',
        ownerId,
        courseId,
        mode: PracticeQuizMode.ADAPTIVE,
        status: PublicationStatus.PUBLISHED,
        pointsMultiplier: 0,
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
      },
    })
    await tx.derivedPermission.create({
      data: {
        practiceQuizId: quiz.id,
        userId: ownerId,
        permissionLevel: PermissionLevel.OWNER,
      },
    })
    const config = await tx.practiceQuizAdaptiveConfig.create({
      data: {
        practiceQuizId: quiz.id,
        competenceTreeId: tree.id,
        preset,
        attemptSelectionPolicy,
        totalQuestionCap: elementTypes.length,
        perLeafQuestionCap: elementTypes.length,
        minQuestionsPerLeaf: elementTypes.length,
        classificationZ: 1.96,
        topInformationRatio: 0.8,
        defaultDiscrimination: 1.2,
        levelMappingRule,
        showTimer: true,
        poolPublishedAt: new Date(),
      },
    })

    const scale = await createReviewedActiveScale({
      tx,
      treeId: tree.id,
      levels,
      creatorId: ownerId,
      reviewerId: ownerId === USER_ID_TEST2 ? USER_ID_TEST : USER_ID_TEST2,
      artifactKey: `adaptive-release-${key}`,
      lowerBounds: [null, -1, 1],
      itemDifficultyPriors: [-2, 0, 2],
    })
    const publication = await tx.practiceQuizAdaptivePublication.create({
      data: {
        version: 1,
        configId: config.id,
        competenceTreeId: tree.id,
        scaleVersionId: scale.id,
        measurementVersion: AdaptiveMeasurementVersion.IRT_V1,
        preset,
        estimatorImplementationVersion: 'irt-v1-legacy',
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
        priorMean: 0,
        priorStandardDeviation: 1,
        gridMin: -6,
        gridMax: 6,
        gridStep: 0.1,
        classificationProbabilityThreshold: null,
        hierarchicalWeightSnapshot: [
          {
            nodeId: root.id,
            name: root.name,
            parentId: null,
            kind: root.kind,
            depth: root.depth,
            order: root.order,
            nodePath: [root.id],
            enabled: true,
            normalizedWeight: 1,
            effectiveLeafWeight: null,
          },
          {
            nodeId: leaf.id,
            name: leaf.name,
            parentId: root.id,
            kind: leaf.kind,
            depth: leaf.depth,
            order: leaf.order,
            nodePath: [root.id, leaf.id],
            enabled: true,
            normalizedWeight: 1,
            effectiveLeafWeight: 1,
          },
        ],
        evidenceMinimumSnapshot: {
          minimumResponsesPerLeaf: elementTypes.length,
          minimumResponsesPerRoot: elementTypes.length,
          requiredRootIds: [root.id],
          classificationZ: 1.96,
          topInformationRatio: 0.8,
          levelMappingRule,
          thetaMin: -3,
          thetaMax: 3,
        },
        totalQuestionCap: elementTypes.length,
        showTimer: true,
        questionCapSnapshot: {
          root: { [String(root.id)]: null },
          node: {
            [String(root.id)]: null,
            [String(leaf.id)]: null,
          },
          leaf: { [String(leaf.id)]: elementTypes.length },
        },
        candidateSetPolicyVersion: 'irt-v1-max-information',
        randomizationPolicyVersion: 'irt-v1-deterministic',
        exposureCeiling: 1,
        overlapPolicyVersion: 'irt-v1-no-exposure-control',
        retakePolicy: attemptSelectionPolicy,
        retakeCooldownDays: 0,
        researchAllocationPolicy: Prisma.JsonNull,
        stoppingPolicyVersion: 'irt-v1-z-interval',
        rolloutPolicyVersion: 1,
        publishedById: ownerId,
      },
    })

    const poolItems = []
    for (const [index, type] of elementTypes.entries()) {
      const options = adaptiveElementOptions(type)
      const element = await tx.element.create({
        data: {
          name: `Adaptive release ${type} ${key}`,
          content: `Adaptive release ${type} question`,
          explanation: `Controlled ${type} release fixture.`,
          type,
          status: ElementStatus.READY,
          options,
          ownerId,
        },
      })
      await tx.derivedPermission.create({
        data: {
          elementId: element.id,
          userId: ownerId,
          permissionLevel: PermissionLevel.OWNER,
        },
      })
      const level = levels[index % levels.length]!
      const assignment = await tx.competenceTreeElementAssignment.create({
        data: {
          treeId: tree.id,
          elementId: element.id,
          leafNodeId: leaf.id,
          levelId: level.id,
          enabled: true,
          enablePercentInput: type === ElementType.NUMERICAL,
        },
      })
      const discrimination = 1.2
      const difficulty = [-2, -1, 0, 1, 2][index] ?? 0
      const guessing = adaptiveGuessing(type)
      const calibration = await tx.adaptiveItemCalibration.create({
        data: {
          treeId: tree.id,
          scaleVersionId: scale.id,
          assignmentId: assignment.id,
          elementId: element.id,
          elementVersion: element.version,
          version: 1,
          model:
            type === ElementType.NUMERICAL || type === ElementType.FREE_TEXT
              ? AdaptiveItemModel.TWO_PL
              : AdaptiveItemModel.THREE_PL_FIXED_C,
          status: AdaptiveItemCalibrationStatus.PROVISIONAL,
          discrimination,
          difficulty,
          guessing,
          parameterUncertainty: {},
          diagnostics: {},
          datasetVersion: 'adaptive-playwright-legacy-v1',
          datasetChecksum: String(assignment.id).padStart(64, '0'),
          modelImplementationVersion: 'irt-v1-author-prior',
          elementContentChecksum: String(element.id).padStart(64, '0'),
          createdById: ownerId,
        },
      })
      const poolItem = await tx.practiceQuizAdaptivePoolItem.create({
        data: {
          configId: config.id,
          competenceTreeId: tree.id,
          publicationId: publication.id,
          scaleVersionId: scale.id,
          calibrationId: calibration.id,
          sourceAssignmentId: assignment.id,
          elementId: element.id,
          elementVersion: element.version,
          elementType: type,
          elementName: element.name,
          elementData: adaptiveElementData(element),
          leafNodeId: leaf.id,
          nodePath: [root.id, leaf.id],
          nodeNamePath: [root.name, leaf.name],
          levelId: level.id,
          levelLabel: level.label,
          levelOrder: level.order,
          discrimination,
          difficulty,
          guessing,
          measurementVersion: AdaptiveMeasurementVersion.IRT_V1,
          calibrationVersion: calibration.version,
          calibrationStatus: calibration.status,
          itemModel: calibration.model,
          modelImplementationVersion: calibration.modelImplementationVersion,
          role: AdaptivePoolItemRole.SCORING,
          contributesToEstimate: true,
          enablePercentInput: type === ElementType.NUMERICAL,
        },
      })
      poolItems.push(poolItem)
    }

    await tx.adaptivePracticeQuizItemExposure.createMany({
      data: poolItems.map((poolItem) => ({
        publicationId: publication.id,
        poolItemId: poolItem.id,
      })),
    })
    const sealedPublication = await tx.practiceQuizAdaptivePublication.update({
      where: { id: publication.id },
      data: { sealedAt: new Date() },
    })

    return {
      tree,
      levels,
      root,
      leaf,
      quiz,
      config,
      scale,
      publication: sealedPublication,
      poolItems,
      courseId,
      ownerId,
    }
  })
}

export async function seedTenPersonSuppressedCohort(
  fixture: AdaptiveReleaseFixture
) {
  const prisma = await getPrisma()
  const participations = await prisma.participation.findMany({
    where: {
      courseId: fixture.courseId,
      participantId: { in: PARTICIPANT_IDS.slice(0, 10) },
    },
    select: { id: true, participantId: true },
  })
  const participationByParticipant = new Map(
    participations.map((participation) => [
      participation.participantId,
      participation.id,
    ])
  )
  if (participationByParticipant.size !== 10) {
    throw new Error('Ten enrolled participants are required for the cohort.')
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, participantId] of PARTICIPANT_IDS.slice(
      0,
      10
    ).entries()) {
      const insufficient = index === 9
      const level =
        index < 5 ? fixture.levels[0]! : index < 9 ? fixture.levels[1]! : null
      const theta = level?.order === 0 ? -1.5 : level?.order === 1 ? 0 : null
      const stopReason = AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP
      const attempt = await tx.adaptivePracticeQuizAttempt.create({
        data: {
          configId: fixture.config.id,
          competenceTreeId: fixture.tree.id,
          publicationId: fixture.publication.id,
          scaleVersionId: fixture.scale.id,
          measurementVersion: fixture.publication.measurementVersion,
          estimatorImplementationVersion:
            fixture.publication.estimatorImplementationVersion,
          classificationPolicyVersion:
            fixture.publication.classificationPolicyVersion,
          calibrationPolicyVersion:
            fixture.publication.calibrationPolicyVersion,
          practiceQuizId: fixture.quiz.id,
          courseId: fixture.courseId,
          participantId,
          participationId: participationByParticipant.get(participantId)!,
          status: AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason,
          currentTheta: theta ?? 0,
          currentStandardError: theta === null ? null : 0.25,
          finalTheta: theta,
          finalStandardError: theta === null ? null : 0.25,
          finalLevelId: level?.id ?? null,
          elapsedSeconds: 120 + index,
          startedAt: new Date(Date.UTC(2026, 6, 20, 12, index, 0)),
          completedAt: new Date(Date.UTC(2026, 6, 20, 12, index, 30)),
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
            theta,
            standardError: theta === null ? null : 0.25,
            responseCount: insufficient ? 0 : 4,
            levelId: level?.id ?? null,
            stopReason: insufficient
              ? AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA
              : stopReason,
          },
          ...[fixture.root, fixture.leaf].map((node) => ({
            attemptId: attempt.id,
            configId: fixture.config.id,
            competenceTreeId: fixture.tree.id,
            nodeKind:
              node.kind === AdaptiveNodeKind.COMPETENCE
                ? AdaptiveEstimateNodeKind.COMPETENCE
                : AdaptiveEstimateNodeKind.SUBCOMPETENCE,
            nodeId: node.id,
            theta,
            standardError: theta === null ? null : 0.25,
            responseCount: insufficient ? 0 : 4,
            levelId: level?.id ?? null,
            stopReason: insufficient
              ? AdaptivePracticeQuizStopReason.INSUFFICIENT_DATA
              : stopReason,
          })),
        ],
      })
    }
  })
}

function adaptiveElementOptions(type: ElementType): Prisma.InputJsonObject {
  if (type === ElementType.NUMERICAL) {
    return {
      hasSampleSolution: true,
      unit: 'ratio',
      accuracy: 2,
      placeholder: '0.5 or 50%',
      restrictions: { min: 0, max: 1 },
      exactSolutions: [0.5],
    }
  }
  if (type === ElementType.FREE_TEXT) {
    return {
      hasSampleSolution: true,
      restrictions: { maxLength: 80 },
      solutions: ['adaptive'],
    }
  }
  const size = type === ElementType.SC ? 2 : 4
  return {
    hasSampleSolution: true,
    hasAnswerFeedbacks: false,
    displayMode: 'LIST',
    choices: Array.from({ length: size }, (_, ix) => ({
      ix,
      value: `${type} option ${ix + 1}`,
      correct: ix === 0 || (type !== ElementType.SC && ix === 2),
    })),
  }
}

function adaptiveGuessing(type: ElementType) {
  if (type === ElementType.SC) return 0.5
  if (type === ElementType.MC) return 0.25
  if (type === ElementType.KPRIM) return 0.0625
  return 0
}

export function adaptiveElementData(
  element: Prisma.ElementGetPayload<Record<string, never>>
): Prisma.InputJsonObject {
  return {
    id: `${element.id}-v${element.version}`,
    elementId: element.id,
    type: element.type,
    name: element.name,
    content: element.content,
    explanation: element.explanation,
    basePoints: element.basePoints,
    pointsMultiplier: element.pointsMultiplier,
    options: element.options as Prisma.InputJsonObject,
  }
}
