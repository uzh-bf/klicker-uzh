import { z } from 'zod'

export const ADAPTIVE_ENGINE_CONTRACT_VERSION = 1 as const
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const finite = z.number().finite()
const probability = finite.min(0).max(1)
const theta = finite.min(-10).max(10)
const ids = z.array(id).max(10000)
const node = z
  .object({
    id,
    parentId: id.nullable(),
    kind: z.enum(['COMPETENCE', 'SUBCOMPETENCE']),
    depth: z.number().int().min(1).max(5),
    order: z.number().int().nonnegative(),
    enabled: z.boolean(),
    weight: finite.nonnegative().nullable(),
    questionCap: z.number().int().positive().max(1000).nullable(),
  })
  .strict()
const poolItem = z
  .object({
    id,
    leafNodeId: id,
    nodePath: z.array(id).min(1).max(5),
    // Optional in both measurement versions; absent keeps one leaf per item.
    additionalLeafNodeIds: z.array(id).max(100).optional(),
    levelId: id,
    discrimination: finite.positive().max(10),
    difficulty: theta,
    guessing: probability,
  })
  .strict()
const v2PoolItem = poolItem
  .extend({
    itemType: z.enum(['SC', 'MC', 'KPRIM', 'NUMERICAL', 'FREE_TEXT']),
    choiceCount: z.number().int().min(2).max(100).nullable(),
    model: z.enum(['TWO_PL', 'THREE_PL_FIXED_C']),
    calibrationId: z.string().min(1).max(128).nullable(),
    contributesToEstimate: z.boolean(),
    role: z.enum(['SCORING', 'ANCHOR', 'FIELD_TEST']),
  })
  .strict()
const settings = z
  .object({
    totalQuestionCap: z.number().int().positive().max(1000),
    perLeafQuestionCap: z.number().int().positive().max(1000).nullable(),
    minQuestionsPerLeaf: z.number().int().nonnegative().max(1000),
    classificationZ: finite.positive().max(10),
    topInformationRatio: finite.positive().max(1),
    levelMappingRule: z.enum(['NEAREST', 'MASTERY']),
    thetaRange: z.object({ min: theta, max: theta }).strict(),
  })
  .strict()
// IRT_V1 only (Catalyst SEQUENTIAL_ROOTS_V6). Hosts omit it for the exact
// rule (0) so requests stay valid for engines that predate it; IRT v2
// settings stay strict without it.
const v1Settings = settings
  .extend({
    classificationToleranceBands: z.number().int().min(0).max(5).optional(),
  })
  .strict()
const v2Settings = settings
  .extend({
    mode: z.enum(['DIAGNOSTIC', 'RESEARCH']),
    stoppingPolicy: z
      .enum([
        'OVERALL_PLACEMENT_PILOT',
        'ROOT_BALANCED_PLACEMENT',
        'FOCUSED_ROOT_BALANCED_PLACEMENT',
      ])
      .optional(),
    credibleMass: finite.positive().lt(1),
    classificationProbabilityThreshold: finite.positive().max(1),
    minimumRootResponses: z.number().int().nonnegative().max(1000),
    researchPolicy: z
      .object({
        anchorResponsesPerLeafLevel: z.number().int().nonnegative().max(1000),
        fieldTestResponsesPerLeaf: z.number().int().nonnegative().max(1000),
        fieldTestInclusionProbability: probability,
        collectionDesignVersion: z.string().min(1).max(128),
      })
      .strict()
      .nullable(),
  })
  .strict()
const level = z
  .object({
    id,
    label: z.string().min(1).max(100),
    order: z.number().int().nonnegative(),
  })
  .strict()
const scale = z
  .object({
    priorMean: theta,
    priorStandardDeviation: finite.positive().max(10),
    gridMin: theta,
    gridMax: theta,
    gridStep: finite.positive(),
    classificationPolicyVersion: z.literal(1),
    levels: z
      .array(
        level
          .extend({
            // null is the unbounded outer edge, never an unknown internal cut.
            lowerBound: theta.nullable(),
            upperBound: theta.nullable(),
            itemDifficultyPrior: theta,
          })
          .strict()
      )
      .min(2)
      .max(50),
  })
  .strict()
const common = {
  contractVersion: z.literal(ADAPTIVE_ENGINE_CONTRACT_VERSION),
  // Existing attempts use UUIDs; retaining that seed preserves tie breaking.
  routingSeed: z.union([z.string().uuid(), z.string().regex(/^[a-f0-9]{64}$/)]),
  nodes: z.array(node).min(1).max(500),
  responses: z
    .array(
      z
        .object({
          order: z.number().int().positive(),
          poolItemId: id,
          correct: z.boolean(),
        })
        .strict()
    )
    .max(1000),
  terminalStopReason: z.literal('INSUFFICIENT_DATA').optional(),
}
// IRT_V1 additional leaves are distinct, differ from the primary leaf, and
// stay in the primary root so one answer never counts for two roots (which
// would double-weight it in the overall result). Disabled leaves remain valid:
// the kernel ignores them, as quiz overrides may disable a subcompetence.
function isValidV1AdditionalMapping(
  item: {
    leafNodeId: number
    nodePath: number[]
    additionalLeafNodeIds?: number[]
  },
  paths: ReadonlyMap<number, number[]>
) {
  const additional = item.additionalLeafNodeIds ?? []
  return (
    new Set(additional).size === additional.length &&
    !additional.includes(item.leafNodeId) &&
    additional.every((id) => paths.get(id)?.[0] === item.nodePath[0])
  )
}
const runtimeStopReason = z.enum([
  'CLASSIFIED',
  'ALL_ROOTS_CLASSIFIED',
  'TOTAL_QUESTION_CAP',
  'NODE_QUESTION_CAP',
  'POOL_EXHAUSTED',
  'INSUFFICIENT_DATA',
  'ABANDONED',
])
export const decisionRequestSchema = z
  .discriminatedUnion('measurementVersion', [
    z
      .object({
        ...common,
        measurementVersion: z.literal('IRT_V1'),
        levels: z.array(level).min(2).max(50),
        pool: z.array(poolItem).min(1).max(10000),
        settings: v1Settings,
      })
      .strict(),
    z
      .object({
        ...common,
        measurementVersion: z.literal('IRT_V2_EAP_GRID_1'),
        scale,
        pool: z.array(v2PoolItem).min(1).max(10000),
        settings: v2Settings,
        selection: z
          .object({
            eligiblePoolItemIds: ids,
            servedCounts: z
              .array(z.tuple([id, z.number().int().nonnegative()]))
              .max(10000),
            priorAttemptPoolItemIds: ids,
          })
          .strict(),
      })
      .strict(),
  ])
  .superRefine((request, ctx) => {
    const reject = (message: string) =>
      ctx.addIssue({ code: 'custom', message })
    const poolIds = new Set(request.pool.map((item) => item.id))
    if (poolIds.size !== request.pool.length) reject('Duplicate pool item IDs')
    if (
      new Set(request.nodes.map((node) => node.id)).size !==
      request.nodes.length
    )
      reject('Duplicate node IDs')
    const nodesById = new Map(request.nodes.map((node) => [node.id, node]))
    const levelIds = new Set(
      (request.measurementVersion === 'IRT_V1'
        ? request.levels
        : request.scale.levels
      ).map((level) => level.id)
    )
    const parents = new Set(
      request.nodes.map((node) => node.parentId).filter((id) => id !== null)
    )
    const paths = new Map<number, number[]>()
    for (const node of request.nodes) {
      const path: number[] = []
      let cursor: typeof node | undefined = node
      while (cursor && path.length <= 5 && !path.includes(cursor.id)) {
        path.unshift(cursor.id)
        if (cursor.parentId === null) break
        cursor = nodesById.get(cursor.parentId)
      }
      if (
        !cursor ||
        cursor.parentId !== null ||
        path.length !== node.depth ||
        (node.parentId === null) !== (node.kind === 'COMPETENCE')
      )
        reject('Invalid competence topology')
      paths.set(node.id, path)
    }
    for (const item of request.pool) {
      const path = paths.get(item.leafNodeId)
      if (
        !path ||
        parents.has(item.leafNodeId) ||
        path.length !== item.nodePath.length ||
        path.some((id, index) => id !== item.nodePath[index]) ||
        !levelIds.has(item.levelId)
      )
        reject('Invalid item mapping')
      if (
        'additionalLeafNodeIds' in item &&
        item.additionalLeafNodeIds?.some(
          (id) => !nodesById.has(id) || parents.has(id)
        )
      )
        reject('Invalid additional item mapping')
      if (
        request.measurementVersion === 'IRT_V1' &&
        !isValidV1AdditionalMapping(item, paths)
      )
        reject('Invalid additional item mapping')
    }
    if (
      new Set(request.responses.map((row) => row.poolItemId)).size !==
      request.responses.length
    )
      reject('Repeated response item')
    if (
      request.responses.some(
        (row, index) => row.order !== index + 1 || !poolIds.has(row.poolItemId)
      )
    )
      reject('Invalid response ledger')
    if (request.settings.thetaRange.min >= request.settings.thetaRange.max)
      reject('Invalid theta range')
    if (request.measurementVersion === 'IRT_V2_EAP_GRID_1') {
      if (
        (request.scale.gridMax - request.scale.gridMin) /
          request.scale.gridStep >
        2000
      )
        reject('Grid is too large')
      if (
        request.scale.levels.some(
          (level, index, levels) =>
            (level.lowerBound === null && index !== 0) ||
            (level.upperBound === null && index !== levels.length - 1)
        )
      )
        reject('Unbounded internal scale edge')
      if (
        request.selection.eligiblePoolItemIds.some((id) => !poolIds.has(id)) ||
        request.selection.servedCounts.some(([id]) => !poolIds.has(id))
      )
        reject('Invalid selection item')
    }
  })
export type DecisionRequest = z.infer<typeof decisionRequestSchema>

export const estimateRequestSchema = z
  .discriminatedUnion('measurementVersion', [
    z
      .object({
        contractVersion: z.literal(ADAPTIVE_ENGINE_CONTRACT_VERSION),
        measurementVersion: z.literal('IRT_V1'),
        nodes: z.array(node).min(1).max(500),
        responses: common.responses,
        terminalReason: runtimeStopReason.nullable(),
        levels: z.array(level).min(2).max(50),
        pool: z.array(poolItem).min(1).max(10000),
        settings: v1Settings,
      })
      .strict(),
    z
      .object({
        contractVersion: z.literal(ADAPTIVE_ENGINE_CONTRACT_VERSION),
        measurementVersion: z.literal('IRT_V2_EAP_GRID_1'),
        nodes: z.array(node).min(1).max(500),
        responses: common.responses,
        terminalReason: runtimeStopReason.nullable(),
        scale,
        pool: z.array(v2PoolItem).min(1).max(10000),
        settings: v2Settings,
      })
      .strict(),
  ])
  .superRefine((request, ctx) => {
    const reject = (message: string) =>
      ctx.addIssue({ code: 'custom', message })
    const poolIds = new Set(request.pool.map((item) => item.id))
    if (poolIds.size !== request.pool.length) reject('Duplicate pool item IDs')
    const nodesById = new Map(request.nodes.map((node) => [node.id, node]))
    if (nodesById.size !== request.nodes.length) reject('Duplicate node IDs')
    const levelIds = new Set(
      (request.measurementVersion === 'IRT_V1'
        ? request.levels
        : request.scale.levels
      ).map((level) => level.id)
    )
    const parents = new Set(
      request.nodes.map((node) => node.parentId).filter((id) => id !== null)
    )
    const paths = new Map<number, number[]>()
    for (const node of request.nodes) {
      const path: number[] = []
      let cursor: typeof node | undefined = node
      while (cursor && path.length <= 5 && !path.includes(cursor.id)) {
        path.unshift(cursor.id)
        if (cursor.parentId === null) break
        cursor = nodesById.get(cursor.parentId)
      }
      if (
        !cursor ||
        cursor.parentId !== null ||
        path.length !== node.depth ||
        (node.parentId === null) !== (node.kind === 'COMPETENCE')
      )
        reject('Invalid competence topology')
      paths.set(node.id, path)
    }
    for (const item of request.pool) {
      const path = paths.get(item.leafNodeId)
      if (
        !path ||
        parents.has(item.leafNodeId) ||
        path.length !== item.nodePath.length ||
        path.some((id, index) => id !== item.nodePath[index]) ||
        !levelIds.has(item.levelId)
      )
        reject('Invalid item mapping')
      if (
        'additionalLeafNodeIds' in item &&
        item.additionalLeafNodeIds?.some(
          (id) => !nodesById.has(id) || parents.has(id)
        )
      )
        reject('Invalid additional item mapping')
      if (
        request.measurementVersion === 'IRT_V1' &&
        !isValidV1AdditionalMapping(item, paths)
      )
        reject('Invalid additional item mapping')
    }
    if (
      new Set(request.responses.map((row) => row.poolItemId)).size !==
        request.responses.length ||
      request.responses.some(
        (row, index) => row.order !== index + 1 || !poolIds.has(row.poolItemId)
      )
    )
      reject('Invalid response ledger')
    if (request.settings.thetaRange.min >= request.settings.thetaRange.max)
      reject('Invalid theta range')
    if (
      request.measurementVersion === 'IRT_V2_EAP_GRID_1' &&
      ((request.scale.gridMax - request.scale.gridMin) /
        request.scale.gridStep >
        2000 ||
        request.scale.levels.some(
          (level, index, levels) =>
            (level.lowerBound === null && index !== 0) ||
            (level.upperBound === null && index !== levels.length - 1)
        ))
    )
      reject('Invalid scale')
  })
export type EstimateRequest = z.infer<typeof estimateRequestSchema>

export const validationRequestSchema = z
  .discriminatedUnion('measurementVersion', [
    z
      .object({
        contractVersion: z.literal(ADAPTIVE_ENGINE_CONTRACT_VERSION),
        measurementVersion: z.literal('IRT_V1'),
        nodes: z.array(node).min(1).max(500),
        responses: common.responses.max(0),
        levels: z.array(level).min(2).max(50),
        pool: z.array(poolItem).min(1).max(10000),
        settings: v1Settings,
      })
      .strict(),
    z
      .object({
        contractVersion: z.literal(ADAPTIVE_ENGINE_CONTRACT_VERSION),
        measurementVersion: z.literal('IRT_V2_EAP_GRID_1'),
        nodes: z.array(node).min(1).max(500),
        responses: common.responses.max(0),
        scale,
        pool: z.array(v2PoolItem).min(1).max(10000),
        settings: v2Settings,
      })
      .strict(),
  ])
  .superRefine((request, ctx) => {
    const result = estimateRequestSchema.safeParse({
      ...request,
      terminalReason: null,
    })
    if (!result.success)
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid adaptive runtime snapshot',
      })
  })
export type ValidationRequest = z.infer<typeof validationRequestSchema>
