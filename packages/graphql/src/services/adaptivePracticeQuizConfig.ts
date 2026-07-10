import {
  DEFAULT_DISCRIMINATION,
  DEFAULT_QUESTION_THRESHOLD,
  DEFAULT_TOP_INFORMATION_RATIO,
  MAX_DISCRIMINATION,
  mapLevelsToTheta,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  MAX_ADAPTIVE_QUESTION_CAP,
  validateAdaptiveQuizReadiness,
  validateAdaptiveSettings,
  type AdaptiveConfiguredAssignment,
  type AdaptiveConfiguredCoverage,
  type AdaptiveConfiguredNode,
  type AdaptiveConfiguredSettings,
  type AdaptiveQuizReadiness,
  type AdaptiveReadinessIssue,
} from './adaptivePracticeQuizReadiness.js'
import {
  deriveAdaptiveItemParameters,
  isSupportedAdaptiveElementType,
} from './competenceTrees.js'

export type AdaptivePracticeQuizNodeOverrideInput = {
  nodeId: number
  enabled: boolean
  weight?: number | null
  questionCap?: number | null
}

export type AdaptivePracticeQuizElementOverrideInput = {
  assignmentId: number
  enabled: boolean
  discrimination?: number | null
}

export type AdaptivePracticeQuizResearchSettingsInput = {
  levelMappingRule?: DB.AdaptiveLevelMappingRule | null
  attemptSelectionPolicy?: DB.AdaptiveAttemptSelectionPolicy | null
  topInformationRatio?: number | null
  defaultDiscrimination?: number | null
  showLiveEstimate?: boolean | null
}

export type AdaptivePracticeQuizConfigInput = {
  competenceTreeId: string
  preset: DB.AdaptivePracticeQuizPreset
  totalQuestionCap?: number | null
  perLeafQuestionCap?: number | null
  minQuestionsPerLeaf?: number | null
  classificationZ?: number | null
  standardErrorThreshold?: number | null
  showTimer?: boolean | null
  nodeOverrides?: AdaptivePracticeQuizNodeOverrideInput[] | null
  elementOverrides?: AdaptivePracticeQuizElementOverrideInput[] | null
  researchSettings?: AdaptivePracticeQuizResearchSettingsInput | null
}

export type AdaptivePracticeQuizNodeView = AdaptiveConfiguredNode & {
  order: number
}

export type AdaptivePracticeQuizAssignmentView = Omit<
  PreparedAdaptiveAssignment,
  'element'
> & {
  a: number
  b: number
  c: number
}

export type AdaptivePracticeQuizConfigView = Pick<
  DB.PracticeQuizAdaptiveConfig,
  | 'id'
  | 'competenceTreeId'
  | 'preset'
  | 'attemptSelectionPolicy'
  | 'totalQuestionCap'
  | 'perLeafQuestionCap'
  | 'minQuestionsPerLeaf'
  | 'classificationZ'
  | 'standardErrorThreshold'
  | 'topInformationRatio'
  | 'defaultDiscrimination'
  | 'levelMappingRule'
  | 'showTimer'
  | 'showFinalResult'
  | 'showLiveEstimate'
  | 'poolPublishedAt'
>

export type AdaptivePracticeQuizPreview = {
  practiceQuizId: string
  mode: DB.PracticeQuizMode
  config: AdaptivePracticeQuizConfigView
  competenceTree: {
    id: string
    name: string
    displayName: string
    description: string | null
    maxDepth: number
    thetaMin: number
    thetaMax: number
    levels: Array<
      DB.CompetenceTreeLevel & {
        theta: number
        lowerBound: number
        upperBound: number
      }
    >
  }
  nodes: AdaptivePracticeQuizNodeView[]
  assignments: AdaptivePracticeQuizAssignmentView[]
  readiness: AdaptiveQuizReadiness
  publishedPoolSize: number
  awardsPoints: false
  awardsExperiencePoints: false
}

export type PreparedAdaptiveAssignment = Omit<
  AdaptiveConfiguredAssignment,
  'elementType'
> & {
  elementType: DB.ElementType
  elementVersion: number
  choiceCount: number | null
  enablePercentInput: boolean
  element: DB.Element
}

export type PreparedAdaptiveConfiguration = {
  config: AdaptivePracticeQuizConfigView
  tree: AdaptiveTreeRecord
  nodes: AdaptivePracticeQuizNodeView[]
  coverages: AdaptiveConfiguredCoverage[]
  assignments: PreparedAdaptiveAssignment[]
  readiness: AdaptiveQuizReadiness
}

const adaptiveTreeInclude = {
  levels: { orderBy: { order: 'asc' as const } },
  nodes: {
    orderBy: [
      { depth: 'asc' as const },
      { parentId: 'asc' as const },
      { order: 'asc' as const },
    ],
  },
  levelCoverages: true,
  elementAssignments: {
    include: { element: true },
    orderBy: { id: 'asc' as const },
  },
} satisfies DB.Prisma.CompetenceTreeInclude

type AdaptiveTreeRecord = DB.Prisma.CompetenceTreeGetPayload<{
  include: typeof adaptiveTreeInclude
}>

const adaptiveConfigInclude = {
  competenceTree: { include: adaptiveTreeInclude },
  nodeOverrides: true,
  elementOverrides: true,
  _count: { select: { attempts: true, publishedPool: true } },
} satisfies DB.Prisma.PracticeQuizAdaptiveConfigInclude

type AdaptiveConfigRecord = DB.Prisma.PracticeQuizAdaptiveConfigGetPayload<{
  include: typeof adaptiveConfigInclude
}>

type ResolvedPresetSettings = AdaptiveConfiguredSettings & {
  preset: DB.AdaptivePracticeQuizPreset
  attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy
  levelMappingRule: DB.AdaptiveLevelMappingRule
  showTimer: boolean
  showFinalResult: true
  showLiveEstimate: boolean
}

export async function replaceAdaptivePracticeQuizConfig(
  {
    practiceQuizId,
    courseId,
    input,
    userId,
  }: {
    practiceQuizId: string
    courseId: string
    input: AdaptivePracticeQuizConfigInput
    userId: string
  },
  prisma: DB.Prisma.TransactionClient
): Promise<string> {
  await lockCompetenceTreeForAdaptiveConfig(prisma, input.competenceTreeId)
  const tree = await prisma.competenceTree.findFirst({
    where: {
      id: input.competenceTreeId,
      isDeleted: false,
      courseLinks: {
        some: {
          courseId,
          course: {
            OR: [
              { ownerId: userId },
              {
                permissions: {
                  some: {
                    userId,
                    permissionLevel: {
                      in: [
                        DB.PermissionLevel.WRITE,
                        DB.PermissionLevel.ADMIN,
                        DB.PermissionLevel.OWNER,
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
    include: adaptiveTreeInclude,
  })
  if (!tree) {
    throw serviceError(
      'The selected competence tree is not linked to a course you can edit.',
      'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE'
    )
  }

  const settings = resolvePresetSettings(input, tree.defaultDiscrimination)
  const prepared = prepareConfiguration({
    tree,
    settings,
    nodeOverrides: input.nodeOverrides ?? [],
    elementOverrides: input.elementOverrides ?? [],
    researchSettingsProvided:
      input.researchSettings !== null &&
      typeof input.researchSettings !== 'undefined',
  })

  const existing = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    include: { _count: { select: { attempts: true } } },
  })
  if (existing && existing._count.attempts > 0) {
    throw serviceError(
      'Adaptive configuration cannot change after an attempt exists. Duplicate the practice quiz instead.',
      'ADAPTIVE_CONFIG_LOCKED'
    )
  }
  if (existing) {
    await prisma.practiceQuizAdaptiveConfig.delete({
      where: { id: existing.id },
    })
  }

  const config = await prisma.practiceQuizAdaptiveConfig.create({
    data: {
      practiceQuizId,
      competenceTreeId: tree.id,
      preset: settings.preset,
      attemptSelectionPolicy: settings.attemptSelectionPolicy,
      totalQuestionCap: settings.totalQuestionCap,
      perLeafQuestionCap: settings.perLeafQuestionCap,
      minQuestionsPerLeaf: settings.minQuestionsPerLeaf,
      classificationZ: settings.classificationZ,
      standardErrorThreshold: settings.standardErrorThreshold,
      topInformationRatio: settings.topInformationRatio,
      defaultDiscrimination: settings.defaultDiscrimination,
      levelMappingRule: settings.levelMappingRule,
      showTimer: settings.showTimer,
      showFinalResult: true,
      showLiveEstimate: settings.showLiveEstimate,
      enableSelfAssessmentWarmup: false,
    },
    select: { id: true },
  })

  await prisma.practiceQuizAdaptiveNodeOverride.createMany({
    data: prepared.nodes.map((node) => ({
      configId: config.id,
      competenceTreeId: tree.id,
      nodeId: node.id,
      enabled: node.enabled,
      weight: node.weight,
      questionCap: node.questionCap,
    })),
  })
  await prisma.practiceQuizAdaptiveElementOverride.createMany({
    data: prepared.assignments.map((assignment) => ({
      configId: config.id,
      competenceTreeId: tree.id,
      assignmentId: assignment.id,
      enabled: assignment.enabled,
      discrimination:
        input.preset === DB.AdaptivePracticeQuizPreset.RESEARCH
          ? (input.elementOverrides?.find(
              (override) => override.assignmentId === assignment.id
            )?.discrimination ?? null)
          : null,
    })),
  })

  return config.id
}

export async function removeAdaptivePracticeQuizConfig(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  const existing = await prisma.practiceQuizAdaptiveConfig.findUnique({
    where: { practiceQuizId },
    include: { _count: { select: { attempts: true } } },
  })
  if (!existing) return
  if (existing._count.attempts > 0) {
    throw serviceError(
      'Adaptive configuration cannot be removed after an attempt exists.',
      'ADAPTIVE_CONFIG_LOCKED'
    )
  }
  await prisma.practiceQuizAdaptiveConfig.delete({ where: { id: existing.id } })
}

export async function getAdaptivePracticeQuizPreview(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<AdaptivePracticeQuizPreview | null> {
  const loaded = await loadAdaptiveConfigurationForQuiz(ctx.prisma, id)
  if (!loaded) return null
  const { quiz, prepared, publishedPoolSize } = loaded

  return {
    practiceQuizId: quiz.id,
    mode: quiz.mode,
    config: prepared.config,
    competenceTree: {
      id: prepared.tree.id,
      name: prepared.tree.name,
      displayName: prepared.tree.displayName,
      description: prepared.tree.description,
      maxDepth: prepared.tree.maxDepth,
      thetaMin: prepared.tree.thetaMin,
      thetaMax: prepared.tree.thetaMax,
      levels: mapTreeLevels(prepared.tree, prepared.config.levelMappingRule),
    },
    nodes: prepared.nodes,
    assignments: prepared.assignments.map(
      ({ element: _element, ...assignment }) => ({
        ...assignment,
        a: assignment.discrimination,
        b: assignment.difficulty,
        c: assignment.guessing,
      })
    ),
    readiness: prepared.readiness,
    publishedPoolSize,
    awardsPoints: false,
    awardsExperiencePoints: false,
  }
}

export async function loadAdaptiveConfigurationForQuiz(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient,
  practiceQuizId: string
): Promise<{
  quiz: Pick<DB.PracticeQuiz, 'id' | 'mode' | 'status' | 'courseId'>
  stackCount: number
  configRecord: AdaptiveConfigRecord
  prepared: PreparedAdaptiveConfiguration
  publishedPoolSize: number
} | null> {
  const quiz = await prisma.practiceQuiz.findUnique({
    where: { id: practiceQuizId, isDeleted: false },
    select: {
      id: true,
      mode: true,
      status: true,
      courseId: true,
      _count: { select: { stacks: true } },
      adaptiveConfig: { include: adaptiveConfigInclude },
    },
  })
  if (
    !quiz ||
    quiz.mode !== DB.PracticeQuizMode.ADAPTIVE ||
    !quiz.adaptiveConfig
  ) {
    return null
  }

  const prepared = prepareStoredConfiguration(quiz.adaptiveConfig)
  if (quiz._count.stacks > 0) {
    prepared.readiness = {
      ...prepared.readiness,
      ready: false,
      errors: [
        ...prepared.readiness.errors,
        {
          code: 'ADAPTIVE_STACKS_FORBIDDEN',
          message:
            'Adaptive practice quizzes cannot contain standard element stacks.',
          path: 'stacks',
        },
      ],
    }
  }
  return {
    quiz: {
      id: quiz.id,
      mode: quiz.mode,
      status: quiz.status,
      courseId: quiz.courseId,
    },
    stackCount: quiz._count.stacks,
    configRecord: quiz.adaptiveConfig,
    prepared,
    publishedPoolSize: quiz.adaptiveConfig._count.publishedPool,
  }
}

function prepareStoredConfiguration(
  config: AdaptiveConfigRecord
): PreparedAdaptiveConfiguration {
  const settings: ResolvedPresetSettings = {
    preset: config.preset,
    attemptSelectionPolicy: config.attemptSelectionPolicy,
    totalQuestionCap: config.totalQuestionCap,
    perLeafQuestionCap: config.perLeafQuestionCap,
    minQuestionsPerLeaf: config.minQuestionsPerLeaf,
    classificationZ: config.classificationZ,
    standardErrorThreshold: config.standardErrorThreshold,
    topInformationRatio: config.topInformationRatio,
    defaultDiscrimination: config.defaultDiscrimination,
    levelMappingRule: config.levelMappingRule,
    showTimer: config.showTimer,
    showFinalResult: true,
    showLiveEstimate: config.showLiveEstimate,
  }
  const prepared = prepareConfiguration({
    tree: config.competenceTree,
    settings,
    nodeOverrides: config.nodeOverrides.map((override) => ({
      nodeId: override.nodeId,
      enabled: override.enabled,
      weight: override.weight,
      questionCap: override.questionCap,
    })),
    elementOverrides: config.elementOverrides.map((override) => ({
      assignmentId: override.assignmentId,
      enabled: override.enabled,
      discrimination: override.discrimination,
    })),
    researchSettingsProvided:
      config.preset === DB.AdaptivePracticeQuizPreset.RESEARCH,
  })

  return {
    ...prepared,
    config: {
      id: config.id,
      competenceTreeId: config.competenceTreeId,
      preset: config.preset,
      attemptSelectionPolicy: config.attemptSelectionPolicy,
      totalQuestionCap: config.totalQuestionCap,
      perLeafQuestionCap: config.perLeafQuestionCap,
      minQuestionsPerLeaf: config.minQuestionsPerLeaf,
      classificationZ: config.classificationZ,
      standardErrorThreshold: config.standardErrorThreshold,
      topInformationRatio: config.topInformationRatio,
      defaultDiscrimination: config.defaultDiscrimination,
      levelMappingRule: config.levelMappingRule,
      showTimer: config.showTimer,
      showFinalResult: config.showFinalResult,
      showLiveEstimate: config.showLiveEstimate,
      poolPublishedAt: config.poolPublishedAt,
    },
  }
}

function prepareConfiguration({
  tree,
  settings,
  nodeOverrides,
  elementOverrides,
  researchSettingsProvided,
}: {
  tree: AdaptiveTreeRecord
  settings: ResolvedPresetSettings
  nodeOverrides: AdaptivePracticeQuizNodeOverrideInput[]
  elementOverrides: AdaptivePracticeQuizElementOverrideInput[]
  researchSettingsProvided: boolean
}): Omit<PreparedAdaptiveConfiguration, 'config'> {
  const errors = validateAdaptiveSettings(settings)
  if (
    researchSettingsProvided &&
    settings.preset !== DB.AdaptivePracticeQuizPreset.RESEARCH
  ) {
    errors.push({
      code: 'ADAPTIVE_RESEARCH_SETTINGS_FORBIDDEN',
      message:
        'Advanced research settings are only valid for the research preset.',
      path: 'researchSettings',
    })
  }

  const nodeOverrideMap = validateNodeOverrides(tree, nodeOverrides, errors)
  const elementOverrideMap = validateElementOverrides(
    tree,
    elementOverrides,
    settings.preset,
    errors
  )
  const normalizedRootWeights = normalizeRootWeights(
    tree.nodes,
    nodeOverrideMap,
    errors
  )
  const nodes: AdaptivePracticeQuizNodeView[] = tree.nodes.map((node) => {
    const override = nodeOverrideMap.get(node.id)
    return {
      id: node.id,
      parentId: node.parentId,
      kind: node.kind,
      name: node.name,
      depth: node.depth,
      order: node.order,
      enabled: override?.enabled ?? true,
      weight:
        node.kind === DB.AdaptiveNodeKind.COMPETENCE
          ? (normalizedRootWeights.get(node.id) ?? 0)
          : null,
      questionCap: override?.questionCap ?? null,
    }
  })

  const mappedLevels = mapTreeLevels(tree, settings.levelMappingRule)
  const levelsById = new Map(mappedLevels.map((level) => [level.id, level]))
  const enabledCoverageCells = new Set(
    tree.levelCoverages
      .filter(({ enabled }) => enabled)
      .map(({ leafNodeId, levelId }) => `${leafNodeId}:${levelId}`)
  )
  const assignments: PreparedAdaptiveAssignment[] = []
  for (const assignment of tree.elementAssignments) {
    const override = elementOverrideMap.get(assignment.id)
    const level = levelsById.get(assignment.levelId)
    if (!level || !isSupportedAdaptiveElementType(assignment.element.type)) {
      errors.push({
        code: 'ADAPTIVE_ASSIGNMENT_INVALID',
        message: `Assignment ${assignment.id} does not have a valid adaptive element type and level.`,
        path: `elementOverrides.${assignment.id}`,
        assignmentId: assignment.id,
      })
      continue
    }

    const choiceCount = getChoiceCount(assignment.element.options)
    const parameters = deriveAdaptiveItemParameters({
      type: assignment.element.type,
      choiceCount,
      levelTheta: level.theta,
      discrimination:
        settings.preset === DB.AdaptivePracticeQuizPreset.RESEARCH
          ? (override?.discrimination ??
            assignment.discrimination ??
            settings.defaultDiscrimination)
          : DEFAULT_DISCRIMINATION,
    })
    assignments.push({
      id: assignment.id,
      elementId: assignment.elementId,
      elementName: assignment.element.name,
      elementVersion: assignment.element.version,
      elementType: assignment.element.type,
      leafNodeId: assignment.leafNodeId,
      levelId: assignment.levelId,
      enabled:
        assignment.enabled &&
        enabledCoverageCells.has(
          `${assignment.leafNodeId}:${assignment.levelId}`
        ) &&
        (override?.enabled ?? true),
      available: !assignment.element.isDeleted,
      discrimination: parameters.a,
      difficulty: parameters.b,
      guessing: parameters.c,
      controlledAnswerReady: isControlledAnswerReady(
        assignment.element.type,
        assignment.element.options
      ),
      choiceCount,
      enablePercentInput: assignment.enablePercentInput,
      element: assignment.element,
    })
  }

  if (errors.length > 0) throwInvalidConfig(errors)

  const coverages = tree.levelCoverages.map((coverage) => ({
    id: coverage.id,
    leafNodeId: coverage.leafNodeId,
    levelId: coverage.levelId,
    targetItemCount: coverage.targetItemCount,
    enabled: coverage.enabled,
  }))
  const readiness = validateAdaptiveQuizReadiness({
    settings,
    nodes,
    coverages,
    assignments,
    levels: mappedLevels,
    thetaRange: { min: tree.thetaMin, max: tree.thetaMax },
  })

  return { tree, nodes, coverages, assignments, readiness }
}

function resolvePresetSettings(
  input: AdaptivePracticeQuizConfigInput,
  treeDefaultDiscrimination: number
): ResolvedPresetSettings {
  const research = input.researchSettings
  const isResearch = input.preset === DB.AdaptivePracticeQuizPreset.RESEARCH
  const isPlacement = input.preset === DB.AdaptivePracticeQuizPreset.PLACEMENT

  return {
    preset: input.preset,
    attemptSelectionPolicy: isPlacement
      ? DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
      : isResearch
        ? (research?.attemptSelectionPolicy ??
          DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED)
        : DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
    levelMappingRule: isPlacement
      ? DB.AdaptiveLevelMappingRule.MASTERY
      : isResearch
        ? (research?.levelMappingRule ?? DB.AdaptiveLevelMappingRule.NEAREST)
        : DB.AdaptiveLevelMappingRule.NEAREST,
    totalQuestionCap: input.totalQuestionCap ?? DEFAULT_QUESTION_THRESHOLD,
    perLeafQuestionCap: input.perLeafQuestionCap ?? null,
    minQuestionsPerLeaf: input.minQuestionsPerLeaf ?? 2,
    classificationZ: input.classificationZ ?? 1.28,
    standardErrorThreshold: input.standardErrorThreshold ?? null,
    topInformationRatio: isResearch
      ? (research?.topInformationRatio ?? DEFAULT_TOP_INFORMATION_RATIO)
      : DEFAULT_TOP_INFORMATION_RATIO,
    defaultDiscrimination: isResearch
      ? (research?.defaultDiscrimination ?? treeDefaultDiscrimination)
      : DEFAULT_DISCRIMINATION,
    showTimer: input.showTimer ?? true,
    showFinalResult: true,
    showLiveEstimate: isResearch
      ? (research?.showLiveEstimate ?? false)
      : false,
  }
}

function validateNodeOverrides(
  tree: AdaptiveTreeRecord,
  overrides: AdaptivePracticeQuizNodeOverrideInput[],
  errors: AdaptiveReadinessIssue[]
): Map<number, AdaptivePracticeQuizNodeOverrideInput> {
  const nodesById = new Map(tree.nodes.map((node) => [node.id, node]))
  const result = new Map<number, AdaptivePracticeQuizNodeOverrideInput>()
  for (const override of overrides) {
    const node = nodesById.get(override.nodeId)
    if (!node || result.has(override.nodeId)) {
      errors.push({
        code: 'ADAPTIVE_NODE_OVERRIDE_INVALID',
        message: `Node override ${override.nodeId} is duplicated or does not belong to the selected tree.`,
        path: `nodeOverrides.${override.nodeId}`,
        nodeId: override.nodeId,
      })
      continue
    }
    if (
      override.weight !== null &&
      typeof override.weight !== 'undefined' &&
      node.kind !== DB.AdaptiveNodeKind.COMPETENCE
    ) {
      errors.push({
        code: 'ADAPTIVE_NON_ROOT_WEIGHT_FORBIDDEN',
        message: 'Quiz weights are only supported for root competences.',
        path: `nodeOverrides.${override.nodeId}.weight`,
        nodeId: override.nodeId,
      })
    }
    if (
      override.questionCap !== null &&
      typeof override.questionCap !== 'undefined' &&
      (!Number.isInteger(override.questionCap) ||
        override.questionCap < 1 ||
        override.questionCap > MAX_ADAPTIVE_QUESTION_CAP)
    ) {
      errors.push({
        code: 'ADAPTIVE_NODE_CAP_INVALID',
        message: `Node question caps must be integers between 1 and ${MAX_ADAPTIVE_QUESTION_CAP}.`,
        path: `nodeOverrides.${override.nodeId}.questionCap`,
        nodeId: override.nodeId,
      })
    }
    result.set(override.nodeId, override)
  }
  return result
}

function validateElementOverrides(
  tree: AdaptiveTreeRecord,
  overrides: AdaptivePracticeQuizElementOverrideInput[],
  preset: DB.AdaptivePracticeQuizPreset,
  errors: AdaptiveReadinessIssue[]
): Map<number, AdaptivePracticeQuizElementOverrideInput> {
  const assignmentIds = new Set(
    tree.elementAssignments.map((assignment) => assignment.id)
  )
  const result = new Map<number, AdaptivePracticeQuizElementOverrideInput>()
  for (const override of overrides) {
    if (
      !assignmentIds.has(override.assignmentId) ||
      result.has(override.assignmentId)
    ) {
      errors.push({
        code: 'ADAPTIVE_ELEMENT_OVERRIDE_INVALID',
        message: `Element override ${override.assignmentId} is duplicated or does not belong to the selected tree.`,
        path: `elementOverrides.${override.assignmentId}`,
        assignmentId: override.assignmentId,
      })
      continue
    }
    if (
      override.discrimination !== null &&
      typeof override.discrimination !== 'undefined'
    ) {
      if (preset !== DB.AdaptivePracticeQuizPreset.RESEARCH) {
        errors.push({
          code: 'ADAPTIVE_DISCRIMINATION_OVERRIDE_FORBIDDEN',
          message:
            'Quiz-specific discrimination overrides require the research preset.',
          path: `elementOverrides.${override.assignmentId}.discrimination`,
          assignmentId: override.assignmentId,
        })
      } else if (
        !Number.isFinite(override.discrimination) ||
        override.discrimination <= 0 ||
        override.discrimination > MAX_DISCRIMINATION
      ) {
        errors.push({
          code: 'ADAPTIVE_DISCRIMINATION_OVERRIDE_INVALID',
          message: `Discrimination must be greater than 0 and at most ${MAX_DISCRIMINATION}.`,
          path: `elementOverrides.${override.assignmentId}.discrimination`,
          assignmentId: override.assignmentId,
        })
      }
    }
    result.set(override.assignmentId, override)
  }
  return result
}

function normalizeRootWeights(
  nodes: DB.CompetenceTreeNode[],
  overrides: Map<number, AdaptivePracticeQuizNodeOverrideInput>,
  errors: AdaptiveReadinessIssue[]
): Map<number, number> {
  const enabledRoots = nodes
    .filter((node) => node.kind === DB.AdaptiveNodeKind.COMPETENCE)
    .filter((node) => overrides.get(node.id)?.enabled ?? true)
    .map((node) => ({
      node,
      weight: overrides.get(node.id)?.weight ?? node.weight,
    }))
  for (const { node, weight } of enabledRoots) {
    if (!Number.isFinite(weight) || weight <= 0) {
      errors.push({
        code: 'ADAPTIVE_ROOT_WEIGHT_INVALID',
        message: `Enabled competence ${node.name} must have a positive finite weight.`,
        path: `nodeOverrides.${node.id}.weight`,
        nodeId: node.id,
      })
    }
  }
  const valid = enabledRoots.filter(
    ({ weight }) => Number.isFinite(weight) && weight > 0
  )
  if (valid.length === 0) return new Map()

  const scale = valid.reduce(
    (maximum, { weight }) => Math.max(maximum, weight),
    0
  )
  const scaled = valid.map(({ node, weight }) => ({
    nodeId: node.id,
    weight: weight / scale,
  }))
  const total = scaled.reduce((sum, entry) => sum + entry.weight, 0)
  return new Map(scaled.map((entry) => [entry.nodeId, entry.weight / total]))
}

function mapTreeLevels(
  tree: AdaptiveTreeRecord,
  mappingRule: DB.AdaptiveLevelMappingRule
) {
  const mapped = mapLevelsToTheta(
    tree.levels,
    { min: tree.thetaMin, max: tree.thetaMax },
    mappingRule
  )
  return tree.levels.map((level, index) => ({
    ...level,
    ...mapped[index]!,
  }))
}

function getChoiceCount(options: unknown): number | null {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return null
  }
  const choices = (options as Record<string, unknown>).choices
  return Array.isArray(choices) ? choices.length : null
}

function isControlledAnswerReady(
  type: DB.ElementType,
  options: unknown
): boolean {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return false
  }
  const value = options as Record<string, unknown>

  if (
    type === DB.ElementType.SC ||
    type === DB.ElementType.MC ||
    type === DB.ElementType.KPRIM
  ) {
    if (!Array.isArray(value.choices) || value.choices.length < 2) return false
    if (type === DB.ElementType.KPRIM && value.choices.length !== 4) {
      return false
    }
    const correctness = value.choices.map((choice) =>
      choice && typeof choice === 'object' && !Array.isArray(choice)
        ? (choice as Record<string, unknown>).correct
        : undefined
    )
    const correctCount = correctness.filter(
      (correct) => correct === true
    ).length
    if (!correctness.every((correct) => typeof correct === 'boolean')) {
      return false
    }
    if (type === DB.ElementType.SC) return correctCount === 1
    if (type === DB.ElementType.MC) return correctCount >= 1
    return true
  }

  if (type === DB.ElementType.NUMERICAL) {
    const exactSolutions = Array.isArray(value.exactSolutions)
      ? value.exactSolutions.filter(
          (solution) =>
            typeof solution === 'number' && Number.isFinite(solution)
        )
      : []
    const ranges = Array.isArray(value.solutionRanges)
      ? value.solutionRanges.filter((range) => {
          if (!range || typeof range !== 'object' || Array.isArray(range)) {
            return false
          }
          const { min, max } = range as Record<string, unknown>
          return (
            (typeof min === 'number' && Number.isFinite(min)) ||
            (typeof max === 'number' && Number.isFinite(max))
          )
        })
      : []
    return exactSolutions.length > 0 || ranges.length > 0
  }

  if (type === DB.ElementType.FREE_TEXT) {
    return (
      Array.isArray(value.solutions) &&
      value.solutions.some(
        (solution) => typeof solution === 'string' && solution.trim().length > 0
      )
    )
  }

  return false
}

function throwInvalidConfig(issues: AdaptiveReadinessIssue[]): never {
  throw new GraphQLError('Adaptive practice quiz configuration is invalid.', {
    extensions: { code: 'ADAPTIVE_CONFIG_INVALID', issues },
  })
}

async function lockCompetenceTreeForAdaptiveConfig(
  prisma: DB.Prisma.TransactionClient,
  competenceTreeId: string
): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; isDeleted: boolean }>
  >`SELECT "id", "isDeleted"
    FROM "CompetenceTree"
    WHERE "id" = ${competenceTreeId}::uuid
    FOR SHARE`
  if (!rows[0] || rows[0].isDeleted) {
    throw serviceError(
      'The selected competence tree is not linked to a course you can edit.',
      'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE'
    )
  }
}

export function adaptiveServiceError(
  message: string,
  code: string
): GraphQLError {
  return serviceError(message, code)
}

function serviceError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}
