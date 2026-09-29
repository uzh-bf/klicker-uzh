import {
  DEFAULT_DISCRIMINATION,
  MAX_DISCRIMINATION,
  mapLevelsToTheta,
} from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import {
  deriveAdaptiveItemParameters,
  getAdaptiveElementChoiceCount,
  hasControlledAdaptiveAnswer,
  isSupportedAdaptiveElementType,
} from './adaptiveElementValidation.js'
import {
  assertPlacementPilotSettings,
  type ResolvedPresetSettings,
  resolvePresetSettings,
} from './adaptivePracticeQuizConfigSettings.js'
import type {
  AdaptivePracticeQuizConfigInput,
  AdaptivePracticeQuizConfigView,
  AdaptivePracticeQuizElementOverrideInput,
  AdaptivePracticeQuizNodeOverrideInput,
} from './adaptivePracticeQuizConfigTypes.js'
import type { AdaptiveSourceElementAvailability } from './adaptivePracticeQuizPublicationAuthorization.js'
import { createAdaptiveBankAnalyzer } from './adaptivePracticeQuizReachability.js'
import {
  type AdaptiveConfiguredAssignment,
  type AdaptiveConfiguredCoverage,
  type AdaptiveConfiguredNode,
  type AdaptiveQuizReadiness,
  type AdaptiveReadinessIssue,
  MAX_ADAPTIVE_QUESTION_CAP,
  validateAdaptiveQuizReadiness,
  validateAdaptiveSettings,
} from './adaptivePracticeQuizReadiness.js'
import { normalizeRootWeights } from './adaptivePracticeQuizRootWeights.js'
import {
  type AdaptiveMeasurementSelection,
  resolveAdaptiveMeasurementSelection,
} from './adaptivePracticeQuizV2Selection.js'

export type {
  AdaptivePracticeQuizConfigInput,
  AdaptivePracticeQuizConfigView,
  AdaptivePracticeQuizElementOverrideInput,
  AdaptivePracticeQuizNodeOverrideInput,
  AdaptivePracticeQuizResearchSettingsInput,
} from './adaptivePracticeQuizConfigTypes.js'

export type AdaptivePracticeQuizNodeView = AdaptiveConfiguredNode & {
  order: number
  overrideEnabled: boolean
  effectiveEnabled: boolean
}

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
    include: { element: true, additionalLeafNodes: { select: { id: true } } },
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
  _count: {
    select: {
      attempts: true,
      publishedPool: {
        where: {
          publication: {
            sealedAt: { not: null },
            supersededAt: null,
            unpublishedAt: null,
          },
        },
      },
    },
  },
} satisfies DB.Prisma.PracticeQuizAdaptiveConfigInclude

export type AdaptiveConfigRecord =
  DB.Prisma.PracticeQuizAdaptiveConfigGetPayload<{
    include: typeof adaptiveConfigInclude
  }>

export type { ResolvedPresetSettings } from './adaptivePracticeQuizConfigSettings.js'

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
  prisma: DB.PrismaClient | PrismaTransactionClient
): Promise<{
  settings: ResolvedPresetSettings
  measurement: AdaptiveMeasurementSelection
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

  const measurement = await resolveAdaptiveMeasurementSelection({
    courseId,
    input,
    tree,
    userId,
    prisma,
  })
  const settings = resolvePresetSettings(input, {
    defaultDiscrimination: tree.defaultDiscrimination,
    defaultTotalQuestionCap: tree.defaultTotalQuestionCap,
    defaultTimeLimitSeconds: tree.defaultTimeLimitSeconds,
  })
  if (
    measurement.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    settings.attemptSelectionPolicy =
      DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED
  }
  assertPlacementPilotSettings(input, settings)
  const prepared = await prepareConfiguration({
    tree,
    settings,
    nodeOverrides: input.nodeOverrides ?? [],
    elementOverrides: input.elementOverrides ?? [],
    researchSettingsProvided:
      input.researchSettings !== null &&
      typeof input.researchSettings !== 'undefined',
  })
  return { settings, measurement, prepared }
}

export async function prepareStoredConfiguration(
  config: AdaptiveConfigRecord,
  sourceElementAvailability: ReadonlyMap<
    number,
    AdaptiveSourceElementAvailability
  >
): Promise<PreparedAdaptiveConfiguration> {
  const settings: ResolvedPresetSettings = {
    preset: config.preset,
    rootBalancedPlacement:
      config.measurementVersion ===
        DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1 &&
      config.preset === DB.AdaptivePracticeQuizPreset.PLACEMENT &&
      Boolean(config.scaleVersionId),
    attemptSelectionPolicy: config.attemptSelectionPolicy,
    totalQuestionCap: config.totalQuestionCap,
    perLeafQuestionCap: config.perLeafQuestionCap,
    minQuestionsPerLeaf: config.minQuestionsPerLeaf,
    classificationZ: config.classificationZ,
    topInformationRatio: config.topInformationRatio,
    defaultDiscrimination: config.defaultDiscrimination,
    levelMappingRule: config.levelMappingRule,
    showTimer: config.showTimer,
    timeLimitSeconds: config.timeLimitSeconds,
  }
  assertPlacementPilotSettings(config, settings)
  const prepared = await prepareConfiguration({
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
      scaleVersionId: config.scaleVersionId,
      measurementVersion: config.measurementVersion,
      calibrationPolicyVersion: config.calibrationPolicyVersion,
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
      timeLimitSeconds: config.timeLimitSeconds,
    },
  }
}

async function prepareConfiguration({
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
}): Promise<Omit<PreparedAdaptiveConfiguration, 'config'>> {
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
  const nodesById = new Map(tree.nodes.map((node) => [node.id, node]))
  const parentIds = new Set(
    tree.nodes.flatMap(({ parentId }) => (parentId === null ? [] : [parentId]))
  )
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

    const additionalLeafNodeIds = assignment.additionalLeafNodes
      .map(({ id }) => id)
      .sort((left, right) => left - right)
    if (additionalLeafNodeIds.length > 0 && !settings.rootBalancedPlacement) {
      errors.push({
        code: 'ADAPTIVE_MULTIPLE_SUBCOMPETENCES_DRAFT_ONLY',
        message:
          'Elements mapped to multiple subcompetences require scale-backed Placement. Other quiz modes do not support these mappings.',
        parameters: {},
        path: `assignments.${assignment.id}.additionalLeafNodeIds`,
        assignmentId: assignment.id,
      })
      continue
    }
    const mappedLeafNodeIds = [assignment.leafNodeId, ...additionalLeafNodeIds]
    const primaryRootId = rootNodeId(assignment.leafNodeId, nodesById)
    if (
      new Set(mappedLeafNodeIds).size !== mappedLeafNodeIds.length ||
      additionalLeafNodeIds.some((leafNodeId) => {
        const leaf = nodesById.get(leafNodeId)
        return (
          leaf === undefined ||
          parentIds.has(leafNodeId) ||
          !effectiveNodeEnabled.get(leafNodeId) ||
          rootNodeId(leafNodeId, nodesById) !== primaryRootId
        )
      })
    ) {
      errors.push({
        code: 'ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAVES_INVALID',
        message: `Assignment ${assignment.id} has invalid additional subcompetence mappings.`,
        parameters: { assignmentId: assignment.id },
        path: `assignments.${assignment.id}.additionalLeafNodeIds`,
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
      additionalLeafNodeIds,
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
  const readiness = await validateAdaptiveQuizReadiness({
    settings,
    nodes,
    coverages,
    assignments,
    levels: mappedLevels,
    thetaRange: { min: tree.thetaMin, max: tree.thetaMax },
    analyzer: createAdaptiveBankAnalyzer(),
  })

  return { tree, nodes, coverages, assignments, readiness }
}

function rootNodeId(
  nodeId: number,
  nodesById: ReadonlyMap<number, { id: number; parentId: number | null }>
) {
  let current = nodesById.get(nodeId)
  while (current?.parentId !== null && current !== undefined) {
    current = nodesById.get(current.parentId)
  }
  return current?.id
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
