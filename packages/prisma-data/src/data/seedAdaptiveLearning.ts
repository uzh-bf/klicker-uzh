import {
  deriveGuessingParameter,
  getAdaptivePresetDefaults,
} from '@klicker-uzh/adaptive-learning'
import * as Prisma from '@klicker-uzh/prisma/client'
import {
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { createHash } from 'node:crypto'
import {
  adaptiveElementContent,
  adaptiveElementExplanation,
  adaptiveSeedChoices,
  adaptiveSeedOptions,
} from './adaptiveLearningElementFixtures.js'
import { COURSE_ID_TEST, COURSE_ID_TEST2, USER_ID_TEST } from './constants.js'
import { prepareQuestion } from './helpers.js'

const ADAPTIVE_COMPETENCE_TREE_ID_TEST = 'b9a9e488-cc25-4cef-bd6f-4fe18cfa9d74'
const ADAPTIVE_PRACTICE_QUIZ_ID_TEST = '6bd53b30-77df-41c4-973b-ff1caa8c9028'
const ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS =
  getAdaptivePresetDefaults('DIAGNOSTIC')
const ADAPTIVE_PRACTICE_QUIZ_LEVELS = [
  'Foundation',
  'Independent',
  'Advanced',
] as const
const ADAPTIVE_PRACTICE_QUIZ_SUPPORTED_TYPES = [
  Prisma.ElementType.SC,
  Prisma.ElementType.MC,
  Prisma.ElementType.KPRIM,
  Prisma.ElementType.NUMERICAL,
  Prisma.ElementType.FREE_TEXT,
] as const
const ADAPTIVE_PRACTICE_QUIZ_VARIANTS_PER_TYPE = 2
const ADAPTIVE_PRACTICE_QUIZ_ITEMS_PER_COVERAGE_CELL =
  ADAPTIVE_PRACTICE_QUIZ_SUPPORTED_TYPES.length *
  ADAPTIVE_PRACTICE_QUIZ_VARIANTS_PER_TYPE
const ADAPTIVE_PRACTICE_QUIZ_LEAVES = [
  {
    key: 'transfer',
    competenceName: 'Reading',
    subCompetenceName: 'Transfer',
  },
  {
    key: 'clarity',
    competenceName: 'Writing',
    subCompetenceName: 'Clarity',
  },
] as const
const ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY = {
  totalQuestionCap:
    ADAPTIVE_PRACTICE_QUIZ_LEAVES.length *
    ADAPTIVE_PRACTICE_QUIZ_LEVELS.length *
    ADAPTIVE_PRACTICE_QUIZ_ITEMS_PER_COVERAGE_CELL,
  perLeafQuestionCap:
    ADAPTIVE_PRACTICE_QUIZ_LEVELS.length *
    ADAPTIVE_PRACTICE_QUIZ_ITEMS_PER_COVERAGE_CELL,
  minQuestionsPerLeaf: 2,
} as const
const ADAPTIVE_LEGACY_ESTIMATOR_VERSION = 'irt-v1-legacy'
const ADAPTIVE_LEGACY_CALIBRATION_MODEL_VERSION = 'irt-v1-author-prior'
const ADAPTIVE_LEGACY_CALIBRATION_DATASET_VERSION = 'legacy-author-prior-v1'

type AdaptiveSeedElementSpec = {
  originalId: string
  name: string
  type: Prisma.ElementType
  content: string
  explanation: string
  choices?: { value: string; feedback?: string; correct?: boolean }[]
  options: any
  competenceName: string
  subCompetenceName: string
  levelLabel: string
}

type AdaptivePracticeQuizSeedElementSpec = AdaptiveSeedElementSpec & {
  leafKey: (typeof ADAPTIVE_PRACTICE_QUIZ_LEAVES)[number]['key']
  levelOrder: number
  enablePercentInput: boolean
}

async function seedAdaptivePracticeQuizElements(prisma: Prisma.PrismaClient) {
  const elements: Array<{
    element: Prisma.Element
    leafKey: AdaptivePracticeQuizSeedElementSpec['leafKey']
    levelOrder: number
    enablePercentInput: boolean
  }> = []

  for (const spec of buildAdaptivePracticeQuizSeedElementSpecs()) {
    const data = prepareQuestion({
      originalId: spec.originalId,
      name: spec.name,
      type: spec.type,
      ownerId: USER_ID_TEST,
      content: spec.content,
      explanation: spec.explanation,
      choices: spec.choices,
      options: spec.options,
    })
    const existingElement = await prisma.element.findFirst({
      where: { originalId: spec.originalId },
    })
    const element = existingElement
      ? await prisma.element.update({
          where: { id: existingElement.id },
          data: {
            ...data,
            status: Prisma.ElementStatus.READY,
            isArchived: false,
            isDeleted: false,
          },
        })
      : await prisma.element.create({
          data: {
            ...data,
            status: Prisma.ElementStatus.READY,
          },
        })

    await recomputeDerivedPermissions(
      { elementId: element.id, userId: USER_ID_TEST },
      prisma
    )
    elements.push({
      element,
      leafKey: spec.leafKey,
      levelOrder: spec.levelOrder,
      enablePercentInput: spec.enablePercentInput,
    })
  }

  return elements
}

function buildAdaptivePracticeQuizSeedElementSpecs(): AdaptivePracticeQuizSeedElementSpec[] {
  return ADAPTIVE_PRACTICE_QUIZ_LEAVES.flatMap((leaf, leafIndex) =>
    ADAPTIVE_PRACTICE_QUIZ_LEVELS.flatMap((levelLabel, levelOrder) =>
      ADAPTIVE_PRACTICE_QUIZ_SUPPORTED_TYPES.flatMap((type, typeIndex) =>
        Array.from(
          { length: ADAPTIVE_PRACTICE_QUIZ_VARIANTS_PER_TYPE },
          (_, variantIndex) => {
            const itemIndex =
              typeIndex * ADAPTIVE_PRACTICE_QUIZ_VARIANTS_PER_TYPE +
              variantIndex
            const numericalSolution =
              20 + levelOrder * 20 + leafIndex * 5 + variantIndex
            const isNumerical = type === Prisma.ElementType.NUMERICAL
            return {
              originalId: [
                'adaptive-practice-quiz',
                leaf.key,
                levelOrder + 1,
                type.toLowerCase(),
                variantIndex + 1,
              ].join('-'),
              name: `Adaptive ${leaf.subCompetenceName} ${levelLabel} ${type} ${variantIndex + 1}`,
              type,
              content: isNumerical
                ? `## ${leaf.competenceName} - ${leaf.subCompetenceName} (${levelLabel})

A learner completed ${numericalSolution} percent of the assigned language exercises.

Enter the percentage as a number.`
                : adaptiveElementContent({
                    competenceName: leaf.competenceName,
                    subCompetenceName: leaf.subCompetenceName,
                    levelLabel,
                    itemIndex,
                    type,
                  }),
              explanation: isNumerical
                ? `The correct response is ${numericalSolution}.`
                : adaptiveElementExplanation({
                    competenceName: leaf.competenceName,
                    subCompetenceName: leaf.subCompetenceName,
                    levelLabel,
                  }),
              choices: isNumerical
                ? undefined
                : adaptiveSeedChoices({
                    type,
                    competenceName: leaf.competenceName,
                    subCompetenceName: leaf.subCompetenceName,
                    levelLabel,
                  }),
              options: isNumerical
                ? {
                    hasSampleSolution: true,
                    accuracy: 0,
                    unit: '%',
                    restrictions: { min: 0, max: 100 },
                    exactSolutions: [numericalSolution],
                  }
                : adaptiveSeedOptions(type),
              competenceName: leaf.competenceName,
              subCompetenceName: leaf.subCompetenceName,
              levelLabel,
              leafKey: leaf.key,
              levelOrder,
              enablePercentInput: isNumerical,
            }
          }
        )
      )
    )
  )
}

export async function seedAdaptivePracticeQuizV2(
  prisma: Prisma.PrismaClient,
  allParticipantIds: readonly string[]
) {
  const elements = await seedAdaptivePracticeQuizElements(prisma)
  const expectedElementCount =
    ADAPTIVE_PRACTICE_QUIZ_LEAVES.length *
    ADAPTIVE_PRACTICE_QUIZ_LEVELS.length *
    ADAPTIVE_PRACTICE_QUIZ_ITEMS_PER_COVERAGE_CELL
  if (elements.length !== expectedElementCount) {
    throw new Error(
      `Expected ${expectedElementCount} adaptive PracticeQuiz seed elements, received ${elements.length}.`
    )
  }

  for (const type of ADAPTIVE_PRACTICE_QUIZ_SUPPORTED_TYPES) {
    if (!elements.some(({ element }) => element.type === type)) {
      throw new Error(`Missing ${type} element for adaptive v2 seed.`)
    }
  }

  await prisma.$transaction(async (tx) => {
    const existingSeed = await tx.practiceQuiz.findUnique({
      where: { id: ADAPTIVE_PRACTICE_QUIZ_ID_TEST },
      select: {
        adaptiveConfig: {
          select: {
            poolPublishedAt: true,
            _count: { select: { attempts: true } },
            publications: {
              where: {
                sealedAt: { not: null },
                supersededAt: null,
                unpublishedAt: null,
              },
              select: { _count: { select: { poolItems: true } } },
            },
          },
        },
      },
    })
    const existingConfig = existingSeed?.adaptiveConfig
    if (
      existingConfig?.poolPublishedAt &&
      existingConfig.publications.length === 1 &&
      existingConfig.publications[0]!._count.poolItems === expectedElementCount
    ) {
      return
    }
    if (existingConfig && existingConfig._count.attempts > 0) {
      throw new Error(
        'The adaptive PracticeQuiz seed has attempts but an incomplete publication. Reset the development database before reseeding.'
      )
    }
    if (existingConfig) {
      const retiredAt = new Date()
      await tx.practiceQuizAdaptivePublication.updateMany({
        where: {
          config: { practiceQuizId: ADAPTIVE_PRACTICE_QUIZ_ID_TEST },
          unpublishedAt: null,
        },
        data: { unpublishedAt: retiredAt },
      })
      await tx.practiceQuizAdaptivePoolItem.deleteMany({
        where: { config: { practiceQuizId: ADAPTIVE_PRACTICE_QUIZ_ID_TEST } },
      })
      await tx.practiceQuizAdaptivePublication.deleteMany({
        where: { config: { practiceQuizId: ADAPTIVE_PRACTICE_QUIZ_ID_TEST } },
      })
    }
    await tx.practiceQuiz.deleteMany({
      where: { id: ADAPTIVE_PRACTICE_QUIZ_ID_TEST },
    })
    await tx.adaptiveItemCalibration.deleteMany({
      where: { treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST },
    })
    await tx.competenceTreeScaleVersion.deleteMany({
      where: { treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST },
    })
    await tx.competenceTree.deleteMany({
      where: { id: ADAPTIVE_COMPETENCE_TREE_ID_TEST },
    })

    await tx.competenceTree.create({
      data: {
        id: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        name: 'adaptive-language-foundations',
        displayName: 'Adaptive language foundations',
        description:
          'Reusable depth-5 competence tree for adaptive Practice Quiz development.',
        maxDepth: 5,
        thetaMin: -3,
        thetaMax: 3,
        defaultDiscrimination: 1.2,
        levelMappingRule: Prisma.AdaptiveLevelMappingRule.NEAREST,
        ownerId: USER_ID_TEST,
        courseLinks: {
          create: [
            { courseId: COURSE_ID_TEST, linkedById: USER_ID_TEST },
            { courseId: COURSE_ID_TEST2, linkedById: USER_ID_TEST },
          ],
        },
      },
    })

    await tx.competenceTreeLevel.createMany({
      data: [
        {
          treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
          label: 'Foundation',
          order: 0,
        },
        {
          treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
          label: 'Independent',
          order: 1,
        },
        {
          treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
          label: 'Advanced',
          order: 2,
        },
      ],
    })
    const levels = await tx.competenceTreeLevel.findMany({
      where: { treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST },
      orderBy: { order: 'asc' },
    })

    const comprehension = await tx.competenceTreeNode.create({
      data: {
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        kind: Prisma.AdaptiveNodeKind.COMPETENCE,
        name: 'Comprehension',
        order: 0,
        depth: 1,
        weight: 3,
      },
    })
    const evidence = await tx.competenceTreeNode.create({
      data: {
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        parentId: comprehension.id,
        kind: Prisma.AdaptiveNodeKind.SUBCOMPETENCE,
        name: 'Evidence',
        order: 0,
        depth: 2,
      },
    })
    const interpretation = await tx.competenceTreeNode.create({
      data: {
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        parentId: evidence.id,
        kind: Prisma.AdaptiveNodeKind.SUBCOMPETENCE,
        name: 'Interpretation',
        order: 0,
        depth: 3,
      },
    })
    const evaluation = await tx.competenceTreeNode.create({
      data: {
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        parentId: interpretation.id,
        kind: Prisma.AdaptiveNodeKind.SUBCOMPETENCE,
        name: 'Evaluation',
        order: 0,
        depth: 4,
      },
    })
    const transfer = await tx.competenceTreeNode.create({
      data: {
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        parentId: evaluation.id,
        kind: Prisma.AdaptiveNodeKind.SUBCOMPETENCE,
        name: 'Transfer',
        order: 0,
        depth: 5,
      },
    })
    const communication = await tx.competenceTreeNode.create({
      data: {
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        kind: Prisma.AdaptiveNodeKind.COMPETENCE,
        name: 'Communication',
        order: 1,
        depth: 1,
        weight: 2,
      },
    })
    const clarity = await tx.competenceTreeNode.create({
      data: {
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        parentId: communication.id,
        kind: Prisma.AdaptiveNodeKind.SUBCOMPETENCE,
        name: 'Clarity',
        order: 0,
        depth: 2,
      },
    })

    const leafNodes = { transfer, clarity }
    const assignmentSpecs = elements.map(
      ({ element, leafKey, levelOrder, enablePercentInput }) => ({
        elementId: element.id,
        leafNodeId: leafNodes[leafKey].id,
        levelId: levels[levelOrder]!.id,
        enablePercentInput,
      })
    )
    const coverageSpecs = Object.values(leafNodes).flatMap((leafNode) =>
      levels.map((level) => ({
        leafNodeId: leafNode.id,
        levelId: level.id,
      }))
    )

    await tx.competenceTreeLeafLevelCoverage.createMany({
      data: coverageSpecs.map(({ leafNodeId, levelId }) => ({
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        leafNodeId,
        levelId,
        targetItemCount: ADAPTIVE_PRACTICE_QUIZ_ITEMS_PER_COVERAGE_CELL,
        enabled: true,
      })),
    })
    await tx.competenceTreeElementAssignment.createMany({
      data: assignmentSpecs.map((assignment) => ({
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        ...assignment,
      })),
    })

    const practiceQuiz = await tx.practiceQuiz.create({
      data: {
        id: ADAPTIVE_PRACTICE_QUIZ_ID_TEST,
        name: 'adaptive-language-check',
        displayName: 'Adaptive language check',
        description:
          'Published adaptive Practice Quiz for running the complete development flow.',
        mode: Prisma.PracticeQuizMode.ADAPTIVE,
        status: Prisma.PublicationStatus.PUBLISHED,
        pointsMultiplier: 0,
        ownerId: USER_ID_TEST,
        courseId: COURSE_ID_TEST,
        adaptiveConfig: {
          create: {
            competenceTreeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
            preset: Prisma.AdaptivePracticeQuizPreset.DIAGNOSTIC,
            attemptSelectionPolicy:
              Prisma.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
            ...ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY,
            classificationZ: ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.classificationZ,
            topInformationRatio:
              ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.topInformationRatio,
            defaultDiscrimination:
              ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.defaultDiscrimination,
            levelMappingRule: Prisma.AdaptiveLevelMappingRule.NEAREST,
            showTimer: ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.showTimer,
          },
        },
      },
      include: { adaptiveConfig: true },
    })

    const adaptiveConfig = practiceQuiz.adaptiveConfig
    if (!adaptiveConfig) {
      throw new Error('Missing adaptive configuration for adaptive v2 seed.')
    }

    const scale = await tx.competenceTreeScaleVersion.create({
      data: {
        treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        version: 1,
        status: Prisma.AdaptiveScaleVersionStatus.DRAFT,
        priorMean: 0,
        priorStandardDeviation: 1,
        gridMin: -6,
        gridMax: 6,
        gridStep: 0.1,
        classificationPolicyVersion: 1,
        createdById: USER_ID_TEST,
        levels: {
          create: levels.map((level, index) => ({
            sourceLevelId: level.id,
            order: level.order,
            label: level.label,
            lowerBound: index === 0 ? null : index === 1 ? -1.5 : 1.5,
            itemDifficultyPrior: [-3, 0, 3][index]!,
          })),
        },
      },
      include: { levels: { orderBy: { order: 'asc' } } },
    })
    await tx.practiceQuizAdaptiveConfig.update({
      where: { id: adaptiveConfig.id },
      data: {
        measurementVersion: Prisma.AdaptiveMeasurementVersion.IRT_V1,
        calibrationPolicyVersion: 1,
        scaleVersionId: scale.id,
      },
    })

    const nodePathByLeafId = new Map([
      [
        transfer.id,
        [comprehension, evidence, interpretation, evaluation, transfer],
      ],
      [clarity.id, [communication, clarity]],
    ])
    const levelThetaByOrder = [-3, 0, 3]
    const publishedAssignments =
      await tx.competenceTreeElementAssignment.findMany({
        where: { treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST },
        include: { element: true, level: true },
        orderBy: { id: 'asc' },
      })
    if (publishedAssignments.length !== expectedElementCount) {
      throw new Error(
        `Expected ${expectedElementCount} adaptive PracticeQuiz pool items, received ${publishedAssignments.length}.`
      )
    }

    const calibrationByAssignment = new Map<
      number,
      Prisma.AdaptiveItemCalibration
    >()
    for (const assignment of publishedAssignments) {
      const scaleLevel = scale.levels.find(
        ({ sourceLevelId }) => sourceLevelId === assignment.levelId
      )
      if (!scaleLevel) {
        throw new Error(
          `Cannot map adaptive assignment ${assignment.id} to the seeded scale.`
        )
      }
      const type = assignment.element
        .type as (typeof ADAPTIVE_PRACTICE_QUIZ_SUPPORTED_TYPES)[number]
      const choiceCount = adaptiveChoiceCount(type, assignment.element.options)
      const calibration = await tx.adaptiveItemCalibration.create({
        data: {
          treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
          scaleVersionId: scale.id,
          assignmentId: assignment.id,
          elementId: assignment.element.id,
          elementVersion: assignment.element.version,
          version: 1,
          model:
            type === Prisma.ElementType.NUMERICAL ||
            type === Prisma.ElementType.FREE_TEXT
              ? Prisma.AdaptiveItemModel.TWO_PL
              : Prisma.AdaptiveItemModel.THREE_PL_FIXED_C,
          status: Prisma.AdaptiveItemCalibrationStatus.PROVISIONAL,
          discrimination:
            assignment.discrimination ??
            ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.defaultDiscrimination,
          difficulty: scaleLevel.itemDifficultyPrior,
          guessing: deriveGuessingParameter({ type, choiceCount }),
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
          datasetVersion: ADAPTIVE_LEGACY_CALIBRATION_DATASET_VERSION,
          datasetChecksum: adaptiveSeedChecksum({
            treeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
            assignmentId: assignment.id,
            elementVersion: assignment.element.version,
          }),
          modelImplementationVersion: ADAPTIVE_LEGACY_CALIBRATION_MODEL_VERSION,
          elementContentChecksum: adaptiveSeedChecksum({
            elementId: assignment.element.id,
            elementVersion: assignment.element.version,
            content: assignment.element.content,
            options: assignment.element.options,
          }),
          createdById: USER_ID_TEST,
        },
      })
      calibrationByAssignment.set(assignment.id, calibration)
    }

    const nodes = [
      comprehension,
      evidence,
      interpretation,
      evaluation,
      transfer,
      communication,
      clarity,
    ]
    const nodePathByNodeId = new Map([
      [comprehension.id, [comprehension]],
      [evidence.id, [comprehension, evidence]],
      [interpretation.id, [comprehension, evidence, interpretation]],
      [evaluation.id, [comprehension, evidence, interpretation, evaluation]],
      [
        transfer.id,
        [comprehension, evidence, interpretation, evaluation, transfer],
      ],
      [communication.id, [communication]],
      [clarity.id, [communication, clarity]],
    ])
    const rootWeightTotal = comprehension.weight + communication.weight
    const effectiveLeafWeightById = new Map([
      [transfer.id, comprehension.weight / rootWeightTotal],
      [clarity.id, communication.weight / rootWeightTotal],
    ])
    const publicationTimestamp = new Date(Date.UTC(2026, 6, 12, 11, 0, 0))
    const publication = await tx.practiceQuizAdaptivePublication.create({
      data: {
        version: 1,
        configId: adaptiveConfig.id,
        competenceTreeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        scaleVersionId: scale.id,
        measurementVersion: Prisma.AdaptiveMeasurementVersion.IRT_V1,
        preset: Prisma.AdaptivePracticeQuizPreset.DIAGNOSTIC,
        estimatorImplementationVersion: ADAPTIVE_LEGACY_ESTIMATOR_VERSION,
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
        hierarchicalWeightSnapshot: nodes.map((node) => ({
          nodeId: node.id,
          name: node.name,
          parentId: node.parentId,
          kind: node.kind,
          depth: node.depth,
          order: node.order,
          nodePath: nodePathByNodeId.get(node.id)!.map(({ id }) => id),
          enabled: true,
          normalizedWeight:
            node.parentId === null ? node.weight / rootWeightTotal : 1,
          effectiveLeafWeight: effectiveLeafWeightById.get(node.id) ?? null,
        })),
        evidenceMinimumSnapshot: {
          minimumResponsesPerLeaf:
            ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY.minQuestionsPerLeaf,
          minimumResponsesPerRoot:
            ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY.minQuestionsPerLeaf,
          requiredRootIds: [comprehension.id, communication.id],
          classificationZ: ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.classificationZ,
          topInformationRatio:
            ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.topInformationRatio,
          levelMappingRule: Prisma.AdaptiveLevelMappingRule.NEAREST,
          thetaMin: -3,
          thetaMax: 3,
        },
        totalQuestionCap:
          ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY.totalQuestionCap,
        showTimer: ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.showTimer,
        questionCapSnapshot: {
          root: {
            [comprehension.id]: null,
            [communication.id]: null,
          },
          node: Object.fromEntries(nodes.map(({ id }) => [id, null])),
          leaf: {
            [transfer.id]:
              ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY.perLeafQuestionCap,
            [clarity.id]:
              ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY.perLeafQuestionCap,
          },
        },
        candidateSetPolicyVersion: 'irt-v1-max-information',
        randomizationPolicyVersion: 'irt-v1-deterministic',
        exposureCeiling: 1,
        overlapPolicyVersion: 'irt-v1-no-exposure-control',
        retakePolicy: Prisma.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
        retakeCooldownDays: practiceQuiz.resetTimeDays,
        researchAllocationPolicy: Prisma.Prisma.JsonNull,
        stoppingPolicyVersion: 'irt-v1-z-interval',
        rolloutPolicyVersion: 1,
        publishedById: USER_ID_TEST,
        publishedAt: publicationTimestamp,
        createdAt: publicationTimestamp,
      },
    })

    await tx.practiceQuizAdaptivePoolItem.createMany({
      data: publishedAssignments.map((assignment) => {
        const nodePath = nodePathByLeafId.get(assignment.leafNodeId)
        const difficulty = levelThetaByOrder[assignment.level.order]
        if (!nodePath || difficulty === undefined) {
          throw new Error(
            `Cannot materialize adaptive assignment ${assignment.id}.`
          )
        }
        const type = assignment.element
          .type as (typeof ADAPTIVE_PRACTICE_QUIZ_SUPPORTED_TYPES)[number]
        const calibration = calibrationByAssignment.get(assignment.id)
        if (!calibration) {
          throw new Error(
            `Cannot materialize adaptive assignment ${assignment.id} without a calibration.`
          )
        }

        return {
          configId: adaptiveConfig.id,
          competenceTreeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
          publicationId: publication.id,
          scaleVersionId: scale.id,
          calibrationId: calibration.id,
          sourceAssignmentId: assignment.id,
          elementId: assignment.element.id,
          elementVersion: assignment.element.version,
          elementType: type,
          elementName: assignment.element.name,
          elementData: processElementData(assignment.element),
          leafNodeId: assignment.leafNodeId,
          nodePath: nodePath.map((node) => node.id),
          nodeNamePath: nodePath.map((node) => node.name),
          levelId: assignment.level.id,
          levelLabel: assignment.level.label,
          levelOrder: assignment.level.order,
          discrimination: calibration.discrimination,
          difficulty: calibration.difficulty,
          guessing: calibration.guessing,
          measurementVersion: Prisma.AdaptiveMeasurementVersion.IRT_V1,
          calibrationVersion: calibration.version,
          calibrationStatus: calibration.status,
          itemModel: calibration.model,
          modelImplementationVersion: calibration.modelImplementationVersion,
          role: Prisma.AdaptivePoolItemRole.SCORING,
          contributesToEstimate: true,
          enablePercentInput: assignment.enablePercentInput,
        }
      }),
    })
    const poolItems = await tx.practiceQuizAdaptivePoolItem.findMany({
      where: { publicationId: publication.id },
      select: { id: true },
    })
    await tx.adaptivePracticeQuizItemExposure.createMany({
      data: poolItems.map(({ id }) => ({
        publicationId: publication.id,
        poolItemId: id,
      })),
    })
    await tx.practiceQuizAdaptivePublication.update({
      where: { id: publication.id },
      data: { sealedAt: publicationTimestamp },
    })
    await tx.practiceQuizAdaptiveConfig.update({
      where: { id: adaptiveConfig.id },
      data: {
        poolPublishedAt: publicationTimestamp,
      },
    })

    const participantIds = allParticipantIds.slice(0, 15)
    const participations = await tx.participation.findMany({
      where: {
        courseId: COURSE_ID_TEST,
        participantId: { in: participantIds },
      },
    })
    const participationByParticipantId = new Map(
      participations.map((participation) => [
        participation.participantId,
        participation,
      ])
    )
    if (participationByParticipantId.size !== participantIds.length) {
      throw new Error(
        'Missing Testkurs participations for adaptive v2 cohort seed.'
      )
    }

    const thetaByLevel = [-2, 0, 2]
    const attempts = participantIds.map((participantId, index) => {
      const participation = participationByParticipantId.get(participantId)!
      const level = levels[index % levels.length]!
      const theta = thetaByLevel[level.order]!
      const stopReason =
        index < 5
          ? Prisma.AdaptivePracticeQuizStopReason.CLASSIFIED
          : index < 10
            ? Prisma.AdaptivePracticeQuizStopReason.TOTAL_QUESTION_CAP
            : Prisma.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED
      const resultStatus =
        index < 5
          ? Prisma.AdaptiveResultStatus.CLASSIFIED
          : index < 10
            ? Prisma.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE
            : Prisma.AdaptiveResultStatus.POOL_LIMITED

      return {
        id: `ad000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        participantId,
        participationId: participation.id,
        level,
        theta,
        stopReason,
        resultStatus,
      }
    })

    await tx.adaptivePracticeQuizAttempt.createMany({
      data: attempts.map((attempt, index) => ({
        id: attempt.id,
        status: Prisma.AdaptivePracticeQuizAttemptStatus.COMPLETED,
        stopReason: attempt.stopReason,
        currentTheta: attempt.theta,
        currentStandardError: 0.2,
        finalTheta: attempt.theta,
        finalStandardError: 0.2,
        finalLevelId: attempt.level.id,
        finalScaleLevelId: scale.levels.find(
          ({ sourceLevelId }) => sourceLevelId === attempt.level.id
        )!.id,
        resultStatus: attempt.resultStatus,
        elapsedSeconds: 240 + index * 10,
        configId: adaptiveConfig.id,
        competenceTreeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
        publicationId: publication.id,
        scaleVersionId: scale.id,
        measurementVersion: Prisma.AdaptiveMeasurementVersion.IRT_V1,
        estimatorImplementationVersion: ADAPTIVE_LEGACY_ESTIMATOR_VERSION,
        classificationPolicyVersion: 1,
        calibrationPolicyVersion: 1,
        practiceQuizId: ADAPTIVE_PRACTICE_QUIZ_ID_TEST,
        courseId: COURSE_ID_TEST,
        participantId: attempt.participantId,
        participationId: attempt.participationId,
        completedAt: new Date(Date.UTC(2026, 6, 12, 12, 0, index)),
      })),
    })
    await tx.adaptivePracticeQuizEstimate.createMany({
      data: attempts.flatMap((attempt) => [
        {
          attemptId: attempt.id,
          configId: adaptiveConfig.id,
          competenceTreeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
          nodeKind: Prisma.AdaptiveEstimateNodeKind.OVERALL,
          nodeId: null,
          theta: attempt.theta,
          standardError: 0.2,
          responseCount: 5,
          stopReason: attempt.stopReason,
          resultStatus: attempt.resultStatus,
          levelId: attempt.level.id,
        },
        ...nodes.map((node) => ({
          attemptId: attempt.id,
          configId: adaptiveConfig.id,
          competenceTreeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
          nodeKind:
            node.kind === Prisma.AdaptiveNodeKind.COMPETENCE
              ? Prisma.AdaptiveEstimateNodeKind.COMPETENCE
              : Prisma.AdaptiveEstimateNodeKind.SUBCOMPETENCE,
          nodeId: node.id,
          theta: attempt.theta,
          standardError: 0.2,
          responseCount: 5,
          stopReason: attempt.stopReason,
          resultStatus: attempt.resultStatus,
          levelId: attempt.level.id,
        })),
      ]),
    })
  })

  await recomputeDerivedPermissions(
    {
      practiceQuizId: ADAPTIVE_PRACTICE_QUIZ_ID_TEST,
      userId: USER_ID_TEST,
    },
    prisma
  )
}

function adaptiveChoiceCount(
  type: (typeof ADAPTIVE_PRACTICE_QUIZ_SUPPORTED_TYPES)[number],
  options: Prisma.Prisma.JsonValue
) {
  if (
    type !== Prisma.ElementType.SC &&
    type !== Prisma.ElementType.MC &&
    type !== Prisma.ElementType.KPRIM
  ) {
    return null
  }
  return (options as { choices?: unknown[] }).choices?.length ?? null
}

function adaptiveSeedChecksum(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
