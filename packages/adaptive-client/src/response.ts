import { z } from 'zod'
import type {
  DecisionRequest,
  EstimateRequest,
  ValidationRequest,
} from './contract.js'

const finite = z.number().finite()
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const probability = finite.min(0).max(1)
const stopReason = z.enum([
  'CLASSIFIED',
  'ALL_ROOTS_CLASSIFIED',
  'TOTAL_QUESTION_CAP',
  'NODE_QUESTION_CAP',
  'POOL_EXHAUSTED',
  'INSUFFICIENT_DATA',
  'ABANDONED',
])
const status = z.enum([
  'CLASSIFIED',
  'BETWEEN_LEVELS',
  'INSUFFICIENT_EVIDENCE',
  'POOL_LIMITED',
  'RESEARCH_ONLY',
])
const estimate = z
  .object({
    nodeKind: z.enum(['OVERALL', 'COMPETENCE', 'SUBCOMPETENCE']),
    nodeId: id.nullable(),
    responseCount: z.number().int().nonnegative(),
    stopReason: stopReason.nullable(),
  })
  .strict()
const legacyEstimate = estimate
  .extend({
    theta: finite.nullable(),
    standardError: finite.nonnegative().nullable(),
    levelId: id.nullable(),
  })
  .strict()
const bayesianEstimate = estimate
  .extend({
    posterior: z
      .object({
        points: z.array(finite).min(2).max(2001),
        probabilities: z.array(probability).min(2).max(2001),
        mean: finite,
        variance: finite.nonnegative(),
        standardDeviation: finite.nonnegative(),
        credibleLower: finite,
        credibleUpper: finite,
        bandProbabilities: z
          .array(z.object({ levelId: id, probability }).strict())
          .min(2)
          .max(50),
      })
      .strict(),
    administeredResponseCount: z.number().int().nonnegative(),
    classifiedLevelId: id.nullable(),
    classificationProbability: probability.nullable(),
    resultStatus: status,
    leadingLevelIds: z.array(id).max(50),
    evidenceSatisfied: z.boolean(),
    evidenceReachable: z.boolean(),
    calibratedCoverageSatisfied: z.boolean(),
  })
  .strict()
const common = {
  contractVersion: z.literal(1),
  nextPoolItemId: id.nullable(),
  stopReason: stopReason.nullable(),
}
export const decisionResponseSchema = z.discriminatedUnion(
  'measurementVersion',
  [
    z
      .object({
        ...common,
        measurementVersion: z.literal('IRT_V1'),
        estimates: z
          .object({
            overall: legacyEstimate,
            nodes: z.array(legacyEstimate).max(500),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...common,
        measurementVersion: z.literal('IRT_V2_EAP_GRID_1'),
        resultStatus: status.nullable(),
        selection: z
          .object({
            role: z.enum(['SCORING', 'ANCHOR', 'FIELD_TEST']),
            conditionalAdministrationProbability: probability,
            collectionDesignVersion: z.string().nullable(),
            randomizationVersion: z.string(),
            randomDraw: z.number().int().min(0).max(0xffffffff),
            candidateSetHash: z.string(),
          })
          .strict()
          .nullable(),
        estimates: z
          .object({
            overall: bayesianEstimate,
            nodes: z.array(bayesianEstimate).max(500),
          })
          .strict(),
      })
      .strict(),
  ]
)
export type DecisionResponse = z.infer<typeof decisionResponseSchema>

export const estimateResponseSchema = z.discriminatedUnion(
  'measurementVersion',
  [
    z
      .object({
        contractVersion: z.literal(1),
        measurementVersion: z.literal('IRT_V1'),
        estimates: z
          .object({
            overall: legacyEstimate,
            nodes: z.array(legacyEstimate).max(500),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        contractVersion: z.literal(1),
        measurementVersion: z.literal('IRT_V2_EAP_GRID_1'),
        estimates: z
          .object({
            overall: bayesianEstimate,
            nodes: z.array(bayesianEstimate).max(500),
          })
          .strict(),
      })
      .strict(),
  ]
)
export type EstimateResponse = z.infer<typeof estimateResponseSchema>

export const validationResponseSchema = z
  .object({
    contractVersion: z.literal(1),
    measurementVersion: z.enum(['IRT_V1', 'IRT_V2_EAP_GRID_1']),
    valid: z.literal(true),
  })
  .strict()
export type ValidationResponse = z.infer<typeof validationResponseSchema>
export function parseValidationResponse(
  input: unknown,
  request: ValidationRequest
): ValidationResponse {
  const result = validationResponseSchema.parse(input)
  if (result.measurementVersion !== request.measurementVersion)
    throw new Error('Invalid adaptive engine validation response')
  return result
}

export function parseEstimateResponse(
  input: unknown,
  request: EstimateRequest
): EstimateResponse {
  const result = estimateResponseSchema.parse(input)
  const fail = () => {
    throw new Error('Invalid adaptive engine estimates response')
  }
  if (
    result.measurementVersion !== request.measurementVersion ||
    result.estimates.overall.nodeKind !== 'OVERALL' ||
    result.estimates.overall.nodeId !== null
  )
    fail()
  const expected = new Set<number>()
  for (const node of [...request.nodes].sort((a, b) => a.depth - b.depth))
    if (node.enabled && (node.parentId === null || expected.has(node.parentId)))
      expected.add(node.id)
  const levels = new Set(
    (request.measurementVersion === 'IRT_V1'
      ? request.levels
      : request.scale.levels
    ).map((level) => level.id)
  )
  const seen = new Set<number>()
  for (const row of result.estimates.nodes) {
    const node = request.nodes.find((node) => node.id === row.nodeId)
    if (
      !node ||
      row.nodeId === null ||
      node.kind !== row.nodeKind ||
      seen.has(row.nodeId) ||
      row.responseCount > request.responses.length
    )
      fail()
    seen.add(row.nodeId!)
    if ('posterior' in row) {
      if (
        row.administeredResponseCount > request.responses.length ||
        (row.classifiedLevelId !== null &&
          !levels.has(row.classifiedLevelId)) ||
        row.leadingLevelIds.some((id) => !levels.has(id)) ||
        row.posterior.points.length !== row.posterior.probabilities.length ||
        row.posterior.credibleLower > row.posterior.credibleUpper ||
        row.posterior.bandProbabilities.length !== levels.size ||
        new Set(row.posterior.bandProbabilities.map((band) => band.levelId))
          .size !== levels.size ||
        row.posterior.bandProbabilities.some(
          (band) => !levels.has(band.levelId)
        ) ||
        Math.abs(
          row.posterior.probabilities.reduce((sum, value) => sum + value, 0) - 1
        ) > 1e-6
      )
        fail()
    } else if (row.levelId !== null && !levels.has(row.levelId)) fail()
  }
  if (seen.size !== expected.size || [...seen].some((id) => !expected.has(id)))
    fail()
  return result
}

// Validate against the request as well as the structural schema. Never persist
// a result that names a foreign item/node or a previously answered question.
export function parseDecisionResponse(
  input: unknown,
  request: DecisionRequest
): DecisionResponse {
  const result = decisionResponseSchema.parse(input)
  const fail = () => {
    throw new Error('Invalid adaptive engine response')
  }
  if (result.measurementVersion !== request.measurementVersion) fail()
  if ((result.nextPoolItemId === null) !== (result.stopReason !== null)) fail()
  if (
    result.nextPoolItemId !== null &&
    (!request.pool.some((item) => item.id === result.nextPoolItemId) ||
      request.responses.some(
        (row) => row.poolItemId === result.nextPoolItemId
      ) ||
      (request.measurementVersion === 'IRT_V2_EAP_GRID_1' &&
        !request.selection.eligiblePoolItemIds.includes(result.nextPoolItemId)))
  )
    fail()
  if (
    result.estimates.overall.nodeKind !== 'OVERALL' ||
    result.estimates.overall.nodeId !== null
  )
    fail()
  const expectedNodeIds = new Set<number>()
  for (const node of [...request.nodes].sort((a, b) => a.depth - b.depth)) {
    if (
      node.enabled &&
      (node.parentId === null || expectedNodeIds.has(node.parentId))
    )
      expectedNodeIds.add(node.id)
  }
  const levels =
    request.measurementVersion === 'IRT_V1'
      ? request.levels
      : request.scale.levels
  const levelIds = new Set(levels.map((level) => level.id))
  const seen = new Set<number>()
  for (const row of result.estimates.nodes) {
    const node = request.nodes.find((node) => node.id === row.nodeId)
    if (
      !node ||
      node.kind !== row.nodeKind ||
      row.nodeId === null ||
      seen.has(row.nodeId)
    )
      fail()
    seen.add(row.nodeId!)
  }
  if (
    seen.size !== expectedNodeIds.size ||
    [...seen].some((id) => !expectedNodeIds.has(id))
  )
    fail()
  for (const row of [result.estimates.overall, ...result.estimates.nodes]) {
    if (row.responseCount > request.responses.length) fail()
    if ('posterior' in row) {
      if (
        row.classifiedLevelId !== null &&
        !levelIds.has(row.classifiedLevelId)
      )
        fail()
      if (
        row.leadingLevelIds.some((id) => !levelIds.has(id)) ||
        row.administeredResponseCount > request.responses.length
      )
        fail()
      const posterior = row.posterior
      if (
        posterior.bandProbabilities.length !== levelIds.size ||
        new Set(posterior.bandProbabilities.map((band) => band.levelId))
          .size !== levelIds.size ||
        posterior.bandProbabilities.some((band) => !levelIds.has(band.levelId))
      )
        fail()
      if (
        posterior.points.length !== posterior.probabilities.length ||
        posterior.credibleLower > posterior.credibleUpper
      )
        fail()
      if (
        Math.abs(posterior.probabilities.reduce((sum, p) => sum + p, 0) - 1) >
        1e-6
      )
        fail()
    } else if (row.levelId !== null && !levelIds.has(row.levelId)) fail()
  }
  return result
}
