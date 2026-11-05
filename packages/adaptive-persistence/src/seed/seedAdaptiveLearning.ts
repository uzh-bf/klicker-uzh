import { createHash } from 'node:crypto'
import { createAdaptiveClient } from '@klicker-uzh/adaptive-client'
import {
  deriveGuessingParameter,
  getAdaptivePresetDefaults,
} from '@klicker-uzh/adaptive-contract'
import * as Prisma from '@klicker-uzh/prisma/client'
import {
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import {
  adaptiveElementContent,
  adaptiveElementExplanation,
  adaptiveSeedChoices,
  adaptiveSeedOptions,
} from './adaptiveLearningElementFixtures.js'
import type {
  AdaptiveSeedRuntime,
  SeedPoolItem,
} from './simulateAdaptiveSeedAttempt.js'
import {
  remapAdaptiveSeedEstimates,
  simulateAdaptiveSeedAttempt,
} from './simulateAdaptiveSeedAttempt.js'

type PrepareQuestion =
  typeof import('@klicker-uzh/prisma-data/adaptive-seed-host-types').prepareQuestion

export function createAdaptiveSeed({
  COURSE_ID_TEST,
  COURSE_ID_TEST2,
  USER_ID_TEST,
  prepareQuestion,
}: {
  COURSE_ID_TEST: string
  COURSE_ID_TEST2: string
  USER_ID_TEST: string
  prepareQuestion: PrepareQuestion
}) {
  const ADAPTIVE_COMPETENCE_TREE_ID_TEST =
    'b9a9e488-cc25-4cef-bd6f-4fe18cfa9d74'
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

  function adaptiveSeedClient() {
    const baseUrl = process.env.ADAPTIVE_ENGINE_URL
    const token = process.env.ADAPTIVE_ENGINE_TOKEN
    if (!baseUrl || !token)
      throw new Error(
        'Adaptive seed evidence requires ADAPTIVE_ENGINE_URL and ADAPTIVE_ENGINE_TOKEN.'
      )
    return createAdaptiveClient({ baseUrl, token })
  }

  function buildAdaptiveSeedRuntime(): AdaptiveSeedRuntime {
    const nodes = [
      {
        id: 1,
        parentId: null,
        kind: 'COMPETENCE',
        depth: 1,
        order: 0,
        enabled: true,
        weight: 3,
        questionCap: null,
      },
      {
        id: 2,
        parentId: 1,
        kind: 'SUBCOMPETENCE',
        depth: 2,
        order: 0,
        enabled: true,
        weight: null,
        questionCap: null,
      },
      {
        id: 3,
        parentId: 2,
        kind: 'SUBCOMPETENCE',
        depth: 3,
        order: 0,
        enabled: true,
        weight: null,
        questionCap: null,
      },
      {
        id: 4,
        parentId: 3,
        kind: 'SUBCOMPETENCE',
        depth: 4,
        order: 0,
        enabled: true,
        weight: null,
        questionCap: null,
      },
      {
        id: 5,
        parentId: 4,
        kind: 'SUBCOMPETENCE',
        depth: 5,
        order: 0,
        enabled: true,
        weight: null,
        questionCap: null,
      },
      {
        id: 6,
        parentId: null,
        kind: 'COMPETENCE',
        depth: 1,
        order: 1,
        enabled: true,
        weight: 2,
        questionCap: null,
      },
      {
        id: 7,
        parentId: 6,
        kind: 'SUBCOMPETENCE',
        depth: 2,
        order: 0,
        enabled: true,
        weight: null,
        questionCap: null,
      },
    ] as const
    const leafByKey = {
      transfer: { id: 5, nodePath: [1, 2, 3, 4, 5] },
      clarity: { id: 7, nodePath: [6, 7] },
    } as const
    const pool = buildAdaptivePracticeQuizSeedElementSpecs().map(
      (spec, index) => {
        const choices = spec.choices?.map((choice, ix) => ({
          ix,
          correct: choice.correct,
        }))
        const choiceCount = choices?.length ?? null
        const leaf = leafByKey[spec.leafKey]
        return {
          id: index + 1,
          leafNodeId: leaf.id,
          nodePath: [...leaf.nodePath],
          levelId: spec.levelOrder + 1,
          levelOrder: spec.levelOrder,
          discrimination:
            ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.defaultDiscrimination,
          difficulty: [-3, 0, 3][spec.levelOrder]!,
          guessing: deriveGuessingParameter({
            type: spec.type as SeedPoolItem['elementType'],
            choiceCount,
          }),
          elementType: spec.type as SeedPoolItem['elementType'],
          elementData: {
            options: {
              choices,
              exactSolutions: Array.isArray(spec.options.exactSolutions)
                ? spec.options.exactSolutions
                : undefined,
              solutions: Array.isArray(spec.options.solutions)
                ? spec.options.solutions
                : undefined,
            },
          },
        }
      }
    )
    return {
      nodes: nodes.map((node) => ({ ...node })),
      levels: ADAPTIVE_PRACTICE_QUIZ_LEVELS.map((_, order) => ({
        id: order + 1,
        order,
      })),
      pool,
      settings: {
        totalQuestionCap:
          ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY.totalQuestionCap,
        perLeafQuestionCap:
          ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY.perLeafQuestionCap,
        minQuestionsPerLeaf:
          ADAPTIVE_DIAGNOSTIC_SEED_STRESS_OVERLAY.minQuestionsPerLeaf,
        classificationZ: ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.classificationZ,
        topInformationRatio:
          ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.topInformationRatio,
        levelMappingRule: ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.levelMappingRule,
        thetaRange: { min: -3, max: 3 },
      },
    }
  }

  async function hasCompleteAdaptiveSeed(
    prisma: Prisma.PrismaClient,
    expectedElementCount: number
  ) {
    const existingSeed = await prisma.practiceQuiz.findUnique({
      where: { id: ADAPTIVE_PRACTICE_QUIZ_ID_TEST },
      select: {
        adaptiveConfig: {
          select: {
            poolPublishedAt: true,
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
    const config = existingSeed?.adaptiveConfig
    return Boolean(
      config?.poolPublishedAt &&
        config.publications.length === 1 &&
        config.publications[0]!._count.poolItems === expectedElementCount
    )
  }

  function assertPersistedSeedRuntimeParity({
    runtime,
    adaptiveConfig,
    persistedNodesBySeedId,
    persistedNodeIdBySeedId,
    persistedLevelIdBySeedId,
    poolItemBySeedId,
  }: {
    runtime: AdaptiveSeedRuntime
    adaptiveConfig: Prisma.PracticeQuizAdaptiveConfig
    persistedNodesBySeedId: ReadonlyMap<number, Prisma.CompetenceTreeNode>
    persistedNodeIdBySeedId: ReadonlyMap<number, number>
    persistedLevelIdBySeedId: ReadonlyMap<number, number>
    poolItemBySeedId: ReadonlyMap<number, Prisma.PracticeQuizAdaptivePoolItem>
  }) {
    if (
      adaptiveConfig.totalQuestionCap !== runtime.settings.totalQuestionCap ||
      adaptiveConfig.perLeafQuestionCap !==
        runtime.settings.perLeafQuestionCap ||
      adaptiveConfig.minQuestionsPerLeaf !==
        runtime.settings.minQuestionsPerLeaf ||
      adaptiveConfig.classificationZ !== runtime.settings.classificationZ ||
      adaptiveConfig.topInformationRatio !==
        runtime.settings.topInformationRatio ||
      adaptiveConfig.levelMappingRule !== runtime.settings.levelMappingRule
    )
      throw new Error(
        'Persisted adaptive seed settings differ from engine input.'
      )

    for (const seedNode of runtime.nodes) {
      const persistedNode = persistedNodesBySeedId.get(seedNode.id)
      const expectedParentId =
        seedNode.parentId === null
          ? null
          : persistedNodeIdBySeedId.get(seedNode.parentId)
      if (
        !persistedNode ||
        persistedNode.id !== persistedNodeIdBySeedId.get(seedNode.id) ||
        persistedNode.parentId !== expectedParentId ||
        persistedNode.kind !== seedNode.kind ||
        persistedNode.depth !== seedNode.depth ||
        persistedNode.order !== seedNode.order ||
        // Only root competences carry a weight in the engine input; non-root
        // nodes are sent with null while the column keeps its default.
        (seedNode.parentId === null && persistedNode.weight !== seedNode.weight)
      )
        throw new Error(
          'Persisted adaptive seed topology differs from engine input.'
        )
    }

    for (const seedItem of runtime.pool) {
      const persistedItem = poolItemBySeedId.get(seedItem.id)
      const expectedNodePath = seedItem.nodePath.map((nodeId) => {
        const persistedNodeId = persistedNodeIdBySeedId.get(nodeId)
        if (!persistedNodeId)
          throw new Error(`Cannot map synthetic node ID ${nodeId}.`)
        return persistedNodeId
      })
      const expectedLevelId = persistedLevelIdBySeedId.get(seedItem.levelId)
      if (
        !persistedItem ||
        !expectedLevelId ||
        persistedItem.leafNodeId !==
          persistedNodeIdBySeedId.get(seedItem.leafNodeId) ||
        persistedItem.levelId !== expectedLevelId ||
        !sameNumberArray(persistedItem.nodePath, expectedNodePath) ||
        persistedItem.discrimination !== seedItem.discrimination ||
        persistedItem.difficulty !== seedItem.difficulty ||
        persistedItem.guessing !== seedItem.guessing
      )
        throw new Error(
          `Persisted calibration differs from engine input for seed item ${seedItem.id}.`
        )
    }
  }

  function sameNumberArray(value: Prisma.Prisma.JsonValue, expected: number[]) {
    return (
      Array.isArray(value) &&
      value.length === expected.length &&
      value.every((entry, index) => entry === expected[index])
    )
  }

  async function seedAdaptivePracticeQuizV2(
    prisma: Prisma.PrismaClient,
    allParticipantIds: readonly string[]
  ) {
    const expectedElementCount =
      ADAPTIVE_PRACTICE_QUIZ_LEAVES.length *
      ADAPTIVE_PRACTICE_QUIZ_LEVELS.length *
      ADAPTIVE_PRACTICE_QUIZ_ITEMS_PER_COVERAGE_CELL
    if (await hasCompleteAdaptiveSeed(prisma, expectedElementCount)) {
      await recomputeDerivedPermissions(
        {
          practiceQuizId: ADAPTIVE_PRACTICE_QUIZ_ID_TEST,
          userId: USER_ID_TEST,
        },
        prisma
      )
      return
    }

    // Service calls happen before any seed write or publication transaction.
    // Runtime IDs are deterministic local coordinates and are remapped to the
    // persisted pool IDs only when the complete evidence ledger is written.
    const runtime = buildAdaptiveSeedRuntime()
    const client = adaptiveSeedClient()
    const participantIds = allParticipantIds.slice(0, 15)
    const attempts: Awaited<ReturnType<typeof simulateAdaptiveSeedAttempt>>[] =
      []
    for (const [index] of participantIds.entries()) {
      const id = `ad000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
      attempts.push(
        await simulateAdaptiveSeedAttempt({
          attemptId: id,
          participantIndex: index,
          runtime,
          client,
        })
      )
    }
    const elements = await seedAdaptivePracticeQuizElements(prisma)
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
        existingConfig.publications[0]!._count.poolItems ===
          expectedElementCount
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
              classificationZ:
                ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.classificationZ,
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
        const choiceCount = adaptiveChoiceCount(
          type,
          assignment.element.options
        )
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
            modelImplementationVersion:
              ADAPTIVE_LEGACY_CALIBRATION_MODEL_VERSION,
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
          // Same retake settings as a published Diagnostic quiz.
          retakeStartFromPreviousResult:
            ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.retakeStartFromPreviousResult,
          retakeStartMaxAgeDays:
            ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.retakeStartMaxAgeDays,
          retakePreferNewQuestions:
            ADAPTIVE_DIAGNOSTIC_SEED_DEFAULTS.retakePreferNewQuestions,
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
      })
      const seedPoolIdByOriginalId = new Map(
        buildAdaptivePracticeQuizSeedElementSpecs().map((spec, index) => [
          spec.originalId,
          index + 1,
        ])
      )
      const assignmentById = new Map(
        publishedAssignments.map((assignment) => [assignment.id, assignment])
      )
      const poolItemBySeedId = new Map(
        poolItems.map((poolItem) => {
          const assignment = assignmentById.get(poolItem.sourceAssignmentId)
          const seedPoolItemId =
            assignment?.element.originalId === null || !assignment
              ? undefined
              : seedPoolIdByOriginalId.get(assignment.element.originalId)
          if (!seedPoolItemId)
            throw new Error(
              `Cannot map persisted pool item ${poolItem.id} to synthetic seed evidence.`
            )
          return [seedPoolItemId, poolItem]
        })
      )
      const persistedNodeIdBySeedId = new Map([
        [1, comprehension.id],
        [2, evidence.id],
        [3, interpretation.id],
        [4, evaluation.id],
        [5, transfer.id],
        [6, communication.id],
        [7, clarity.id],
      ])
      const persistedLevelIdBySeedId = new Map(
        levels.map((level) => [level.order + 1, level.id])
      )
      assertPersistedSeedRuntimeParity({
        runtime,
        adaptiveConfig,
        persistedNodesBySeedId: new Map([
          [1, comprehension],
          [2, evidence],
          [3, interpretation],
          [4, evaluation],
          [5, transfer],
          [6, communication],
          [7, clarity],
        ]),
        persistedNodeIdBySeedId,
        persistedLevelIdBySeedId,
        poolItemBySeedId,
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

      for (const [index, participantId] of participantIds.entries()) {
        const id = `ad000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
        const { history, estimates, stopReason } = attempts[index]!
        const remappedEstimates = remapAdaptiveSeedEstimates({
          estimates,
          persistedNodeIdBySeedId,
          persistedLevelIdBySeedId,
        })
        const overall = remappedEstimates.overall
        const elapsedSeconds = history.reduce(
          (sum, response) => sum + response.elapsedSeconds,
          0
        )
        const completedAt = new Date(Date.UTC(2026, 6, 12, 12, 0, index))
        await tx.adaptivePracticeQuizAttempt.create({
          data: {
            id,
            status: Prisma.AdaptivePracticeQuizAttemptStatus.COMPLETED,
            stopReason,
            currentTheta: overall.theta ?? 0,
            currentStandardError: overall.standardError,
            finalTheta: overall.theta,
            finalStandardError: overall.standardError,
            finalLevelId: overall.levelId,
            finalScaleLevelId:
              scale.levels.find(
                ({ sourceLevelId }) => sourceLevelId === overall.levelId
              )?.id ?? null,
            elapsedSeconds,
            startedAt: new Date(completedAt.getTime() - elapsedSeconds * 1000),
            completedAt,
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
            participantId,
            participationId:
              participationByParticipantId.get(participantId)!.id,
          },
        })
        let responseTime = completedAt.getTime() - elapsedSeconds * 1000
        await tx.adaptivePracticeQuizResponse.createMany({
          data: history.map(
            ({
              item: seedItem,
              order,
              correct,
              answer,
              before,
              after,
              elapsedSeconds,
            }) => {
              const item = poolItemBySeedId.get(seedItem.id)
              if (!item)
                throw new Error(
                  `Cannot persist evidence for synthetic pool item ${seedItem.id}.`
                )
              responseTime += elapsedSeconds * 1000
              return {
                attemptId: id,
                configId: adaptiveConfig.id,
                publicationId: publication.id,
                assignmentId: item.sourceAssignmentId,
                poolItemId: item.id,
                elementId: item.elementId,
                elementSnapshot:
                  item.elementData as Prisma.Prisma.InputJsonObject,
                order,
                response: answer,
                normalizedResponse: answer,
                score: correct ? 1 : 0,
                correct,
                overallThetaBefore: before,
                overallThetaAfter: after.theta,
                overallStandardErrorAfter: after.standardError,
                elapsedSeconds,
                createdAt: new Date(responseTime),
              }
            }
          ),
        })
        await tx.adaptivePracticeQuizEstimate.createMany({
          data: [overall, ...remappedEstimates.nodes].map((estimate) => ({
            ...estimate,
            attemptId: id,
            configId: adaptiveConfig.id,
            competenceTreeId: ADAPTIVE_COMPETENCE_TREE_ID_TEST,
          })),
        })
      }
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
  return { seedAdaptivePracticeQuizV2, buildAdaptiveSeedRuntime }
}
