import {
  DEFAULT_DISCRIMINATION,
  MAX_DISCRIMINATION,
  getAdaptivePresetDefaults,
  mapLevelsToTheta,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import {
  deriveAdaptiveItemParameters,
  getAdaptiveElementChoiceCount,
  hasControlledAdaptiveAnswer,
  isSupportedAdaptiveElementType,
} from './adaptiveElementValidation.js'
import { type AdaptiveSourceElementAvailability } from './adaptivePracticeQuizPublicationAuthorization.js'
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
}

export type AdaptivePracticeQuizConfigInput = {
  competenceTreeId: string
  preset: DB.AdaptivePracticeQuizPreset
  totalQuestionCap?: number | null
  perLeafQuestionCap?: number | null
  minQuestionsPerLeaf?: number | null
  classificationZ?: number | null
  showTimer?: boolean | null
  nodeOverrides?: AdaptivePracticeQuizNodeOverrideInput[] | null
  elementOverrides?: AdaptivePracticeQuizElementOverrideInput[] | null
  researchSettings?: AdaptivePracticeQuizResearchSettingsInput | null
}

export type AdaptivePracticeQuizNodeView = AdaptiveConfiguredNode & {
  order: number
  overrideEnabled: boolean
  effectiveEnabled: boolean
}

export type AdaptivePracticeQuizConfigView = Pick<
  DB.PracticeQuizAdaptiveConfig,
  | 'competenceTreeId'
  | 'preset'
  | 'attemptSelectionPolicy'
  | 'totalQuestionCap'
  | 'perLeafQuestionCap'
  | 'minQuestionsPerLeaf'
  | 'classificationZ'
  | 'topInformationRatio'
  | 'defaultDiscrimination'
  | 'levelMappingRule'
  | 'showTimer'
>

export type PreparedAdaptiveAssignment = Omit<
  AdaptiveConfiguredAssignment,
  'elementType'
> & {
  elementType: DB.ElementType
  elementVersion: number
  choiceCount: number | null
  enablePercentInput: boolean
  sourceEnabled: boolean
  overrideEnabled: boolean
  effectiveEnabled: boolean
  overrideDiscrimination: number | null
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
  courseLinks: true,
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

export type AdaptiveTreeRecord = DB.Prisma.CompetenceTreeGetPayload<{
  include: typeof adaptiveTreeInclude
}>

export const adaptiveConfigInclude = {
  competenceTree: { include: adaptiveTreeInclude },
  nodeOverrides: true,
  elementOverrides: true,
  _count: { select: { attempts: true, publishedPool: true } },
} satisfies DB.Prisma.PracticeQuizAdaptiveConfigInclude

export type AdaptiveConfigRecord =
  DB.Prisma.PracticeQuizAdaptiveConfigGetPayload<{
    include: typeof adaptiveConfigInclude
  }>

export type ResolvedPresetSettings = AdaptiveConfiguredSettings & {
  preset: DB.AdaptivePracticeQuizPreset
  attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy
  levelMappingRule: DB.AdaptiveLevelMappingRule
  showTimer: boolean
}

export async function prepareConfigurationInput(
  {
    courseId,
    input,
    userId,
  }: {
    courseId: string
    input: AdaptivePracticeQuizConfigInput
    userId: string
  },
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
): Promise<{
  settings: ResolvedPresetSettings
  prepared: Omit<PreparedAdaptiveConfiguration, 'config'>
}> {
  const tree = await prisma.competenceTree.findFirst({
    where: {
      id: input.competenceTreeId,
      isDeleted: false,
      isArchived: false,
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
    throw adaptiveServiceError(
      'The selected competence tree is not linked to a course you can edit.',
      'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE'
    )
  }

  const settings = resolvePresetSettings(input, tree.defaultDiscrimination)
  return {
    settings,
    prepared: prepareConfiguration({
      tree,
      settings,
      nodeOverrides: input.nodeOverrides ?? [],
      elementOverrides: input.elementOverrides ?? [],
      researchSettingsProvided:
        input.researchSettings !== null &&
        typeof input.researchSettings !== 'undefined',
    }),
  }
}

export function prepareStoredConfiguration(
  config: AdaptiveConfigRecord,
  sourceElementAvailability: ReadonlyMap<
    number,
    AdaptiveSourceElementAvailability
  >
): PreparedAdaptiveConfiguration {
  const settings: ResolvedPresetSettings = {
    preset: config.preset,
    attemptSelectionPolicy: config.attemptSelectionPolicy,
    totalQuestionCap: config.totalQuestionCap,
    perLeafQuestionCap: config.perLeafQuestionCap,
    minQuestionsPerLeaf: config.minQuestionsPerLeaf,
    classificationZ: config.classificationZ,
    topInformationRatio: config.topInformationRatio,
    defaultDiscrimination: config.defaultDiscrimination,
    levelMappingRule: config.levelMappingRule,
    showTimer: config.showTimer,
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
    sourceElementAvailability,
  })

  return {
    ...prepared,
    config: {
      competenceTreeId: config.competenceTreeId,
      preset: config.preset,
      attemptSelectionPolicy: config.attemptSelectionPolicy,
      totalQuestionCap: config.totalQuestionCap,
      perLeafQuestionCap: config.perLeafQuestionCap,
      minQuestionsPerLeaf: config.minQuestionsPerLeaf,
      classificationZ: config.classificationZ,
      topInformationRatio: config.topInformationRatio,
      defaultDiscrimination: config.defaultDiscrimination,
      levelMappingRule: config.levelMappingRule,
      showTimer: config.showTimer,
    },
  }
}

function prepareConfiguration({
  tree,
  settings,
  nodeOverrides,
  elementOverrides,
  researchSettingsProvided,
  sourceElementAvailability,
}: {
  tree: AdaptiveTreeRecord
  settings: ResolvedPresetSettings
  nodeOverrides: AdaptivePracticeQuizNodeOverrideInput[]
  elementOverrides: AdaptivePracticeQuizElementOverrideInput[]
  researchSettingsProvided: boolean
  sourceElementAvailability?: ReadonlyMap<
    number,
    AdaptiveSourceElementAvailability
  >
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
      parameters: {},
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
  const nodesWithOverrides = tree.nodes.map((node) => {
    const override = nodeOverrideMap.get(node.id)
    return {
      id: node.id,
      parentId: node.parentId,
      kind: node.kind,
      name: node.name,
      depth: node.depth,
      order: node.order,
      overrideEnabled: override?.enabled ?? true,
      weight:
        node.kind === DB.AdaptiveNodeKind.COMPETENCE
          ? (normalizedRootWeights.get(node.id) ?? 0)
          : null,
      questionCap: override?.questionCap ?? null,
    }
  })
  const effectiveNodeEnabled = new Map<number, boolean>()
  for (const node of nodesWithOverrides
    .slice()
    .sort((left, right) => left.depth - right.depth)) {
    const ancestorEnabled =
      node.parentId === null
        ? true
        : (effectiveNodeEnabled.get(node.parentId) ?? false)
    effectiveNodeEnabled.set(node.id, node.overrideEnabled && ancestorEnabled)
  }
  const nodes: AdaptivePracticeQuizNodeView[] = nodesWithOverrides.map(
    (node) => {
      const effectiveEnabled = effectiveNodeEnabled.get(node.id) ?? false
      return {
        ...node,
        enabled: effectiveEnabled,
        effectiveEnabled,
      }
    }
  )

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
        parameters: { assignmentId: assignment.id },
        path: `elementOverrides.${assignment.id}`,
        assignmentId: assignment.id,
      })
      continue
    }

    const choiceCount = getAdaptiveElementChoiceCount(
      assignment.element.options
    )
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
    const sourceEnabled = assignment.enabled
    const overrideEnabled = override?.enabled ?? true
    const overrideDiscrimination = override?.discrimination ?? null
    const effectiveEnabled =
      sourceEnabled &&
      enabledCoverageCells.has(
        `${assignment.leafNodeId}:${assignment.levelId}`
      ) &&
      overrideEnabled &&
      (effectiveNodeEnabled.get(assignment.leafNodeId) ?? false)
    const resolvedAvailability = sourceElementAvailability?.get(
      assignment.elementId
    )
    const availabilityReason = assignment.element.isDeleted
      ? 'DELETED'
      : resolvedAvailability === 'OWNER_ACCESS_REVOKED'
        ? 'OWNER_ACCESS_REVOKED'
        : null
    assignments.push({
      id: assignment.id,
      elementId: assignment.elementId,
      elementName: assignment.element.name,
      elementVersion: assignment.element.version,
      elementType: assignment.element.type,
      leafNodeId: assignment.leafNodeId,
      levelId: assignment.levelId,
      enabled: effectiveEnabled,
      sourceEnabled,
      overrideEnabled,
      effectiveEnabled,
      overrideDiscrimination,
      available: availabilityReason === null,
      availabilityReason,
      discrimination: parameters.a,
      difficulty: parameters.b,
      guessing: parameters.c,
      controlledAnswerReady: hasControlledAdaptiveAnswer(
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
  const defaults = getAdaptivePresetDefaults(input.preset, {
    treeDefaultDiscrimination,
  })

  return {
    preset: input.preset,
    attemptSelectionPolicy: isResearch
      ? (research?.attemptSelectionPolicy ?? defaults.attemptSelectionPolicy)
      : defaults.attemptSelectionPolicy,
    levelMappingRule: isResearch
      ? (research?.levelMappingRule ?? defaults.levelMappingRule)
      : defaults.levelMappingRule,
    totalQuestionCap: input.totalQuestionCap ?? defaults.totalQuestionCap,
    perLeafQuestionCap: input.perLeafQuestionCap ?? defaults.perLeafQuestionCap,
    minQuestionsPerLeaf:
      input.minQuestionsPerLeaf ?? defaults.minQuestionsPerLeaf,
    classificationZ: input.classificationZ ?? defaults.classificationZ,
    topInformationRatio: isResearch
      ? (research?.topInformationRatio ?? defaults.topInformationRatio)
      : defaults.topInformationRatio,
    defaultDiscrimination: isResearch
      ? (research?.defaultDiscrimination ?? defaults.defaultDiscrimination)
      : defaults.defaultDiscrimination,
    showTimer: input.showTimer ?? defaults.showTimer,
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
        parameters: { nodeId: override.nodeId },
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
        parameters: {},
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
        parameters: {
          minimumValue: 1,
          maximumValue: MAX_ADAPTIVE_QUESTION_CAP,
        },
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
        parameters: { assignmentId: override.assignmentId },
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
          parameters: {},
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
          parameters: {
            minimumValue: 0,
            maximumValue: MAX_DISCRIMINATION,
          },
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
        parameters: { nodeName: node.name },
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

export function mapTreeLevels(
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

function throwInvalidConfig(issues: AdaptiveReadinessIssue[]): never {
  throw new GraphQLError('Adaptive practice quiz configuration is invalid.', {
    extensions: { code: 'ADAPTIVE_CONFIG_INVALID', issues },
  })
}

export function adaptiveServiceError(
  message: string,
  code: string
): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}
