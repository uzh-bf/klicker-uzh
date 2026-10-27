import { z } from 'zod'

const finite = z.number().finite()
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const localId = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const probability = finite.min(0).max(1)
const theta = finite.min(-10).max(10)

export const MAX_POSTERIOR_BATCH_SUBJECTS = 32
export const MAX_POSTERIOR_RESPONSES_PER_SUBJECT = 1000
export const MAX_POSTERIOR_BATCH_RESPONSES = 8000

const level = z
  .object({
    id,
    label: z.string().min(1).max(100),
    order: z.number().int().nonnegative(),
    lowerBound: theta.nullable(),
    upperBound: theta.nullable(),
    itemDifficultyPrior: theta,
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
    levels: z.array(level).min(2).max(50),
  })
  .strict()

const scoredItem = z
  .object({
    id: z.union([finite, z.string().min(1).max(128)]),
    itemType: z.enum(['SC', 'MC', 'KPRIM', 'NUMERICAL', 'FREE_TEXT']),
    choiceCount: z.number().int().min(2).max(100).nullable(),
    model: z.enum(['TWO_PL', 'THREE_PL_FIXED_C']),
    calibrationId: z.string().min(1).max(128),
    a: finite.positive().max(10),
    b: theta,
    c: finite.min(0).lt(1),
  })
  .strict()

const subject = z
  .object({
    localId,
    responses: z
      .array(z.object({ item: scoredItem, correct: z.boolean() }).strict())
      .min(1)
      .max(MAX_POSTERIOR_RESPONSES_PER_SUBJECT),
  })
  .strict()

export const posteriorBatchRequestSchema = z
  .object({
    contractVersion: z.literal(1),
    measurementVersion: z.literal('IRT_V2_EAP_GRID_1'),
    scale,
    credibleMass: finite.positive().lt(1),
    subjects: z.array(subject).min(1).max(MAX_POSTERIOR_BATCH_SUBJECTS),
  })
  .strict()
  .superRefine((request, ctx) => {
    const reject = (message: string) =>
      ctx.addIssue({ code: 'custom', message })
    if (
      new Set(request.subjects.map((subject) => subject.localId)).size !==
      request.subjects.length
    )
      reject('Duplicate local subject IDs')
    if (
      request.subjects.reduce(
        (count, subject) => count + subject.responses.length,
        0
      ) > MAX_POSTERIOR_BATCH_RESPONSES
    )
      reject('Posterior batch has too many responses')
    if (
      (request.scale.gridMax - request.scale.gridMin) / request.scale.gridStep >
      2000
    )
      reject('Grid is too large')
    if (
      request.scale.priorMean < request.scale.gridMin ||
      request.scale.priorMean > request.scale.gridMax
    )
      reject('Prior mean must lie within the posterior grid')
    if (request.scale.priorStandardDeviation < request.scale.gridStep)
      reject(
        'Prior standard deviation must be at least the posterior grid step'
      )
    const levels = [...request.scale.levels].sort((a, b) => a.order - b.order)
    if (new Set(levels.map((level) => level.id)).size !== levels.length)
      reject('Duplicate scale level IDs')
    for (const [index, current] of levels.entries()) {
      const previous = levels[index - 1]
      if (
        current.order !== index ||
        (index === 0 && current.lowerBound !== null) ||
        (index === levels.length - 1 && current.upperBound !== null) ||
        (index > 0 &&
          (current.lowerBound === null ||
            current.lowerBound !== previous!.upperBound)) ||
        (index < levels.length - 1 && current.upperBound === null) ||
        (current.lowerBound !== null &&
          current.upperBound !== null &&
          current.lowerBound >= current.upperBound) ||
        (current.lowerBound !== null &&
          (current.lowerBound <= request.scale.gridMin ||
            current.lowerBound >= request.scale.gridMax)) ||
        (current.upperBound !== null &&
          (current.upperBound <= request.scale.gridMin ||
            current.upperBound >= request.scale.gridMax)) ||
        current.itemDifficultyPrior < request.scale.gridMin ||
        current.itemDifficultyPrior > request.scale.gridMax
      )
        reject('Invalid scale levels')
    }
    for (const subject of request.subjects) {
      const itemIds = new Set<string>()
      const calibrationIds = new Set<string>()
      for (const response of subject.responses) {
        const { item } = response
        const itemId = `${typeof item.id}:${item.id}`
        if (itemIds.has(itemId) || calibrationIds.has(item.calibrationId))
          reject('Repeated scored item')
        itemIds.add(itemId)
        calibrationIds.add(item.calibrationId)
        const choiceItem = ['SC', 'MC', 'KPRIM'].includes(item.itemType)
        const expectedModel = choiceItem ? 'THREE_PL_FIXED_C' : 'TWO_PL'
        const expectedGuessing =
          item.itemType === 'SC'
            ? 1 / item.choiceCount!
            : item.itemType === 'MC'
              ? 1 / (2 ** item.choiceCount! - 1)
              : item.itemType === 'KPRIM'
                ? 1 / 2 ** item.choiceCount!
                : 0
        if (
          (!choiceItem && item.choiceCount !== null) ||
          (item.itemType === 'KPRIM' && item.choiceCount !== 4) ||
          item.model !== expectedModel ||
          item.c !== expectedGuessing
        )
          reject('Invalid scored item parameters')
      }
    }
  })

export type PosteriorBatchRequest = z.infer<typeof posteriorBatchRequestSchema>

const posteriorSummary = z
  .object({
    localId,
    responseCount: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_POSTERIOR_RESPONSES_PER_SUBJECT),
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
  .strict()

export const posteriorBatchResponseSchema = z
  .object({
    contractVersion: z.literal(1),
    measurementVersion: z.literal('IRT_V2_EAP_GRID_1'),
    subjects: z
      .array(posteriorSummary)
      .min(1)
      .max(MAX_POSTERIOR_BATCH_SUBJECTS),
  })
  .strict()

export type PosteriorBatchResponse = z.infer<
  typeof posteriorBatchResponseSchema
>

export function parsePosteriorBatchResponse(
  input: unknown,
  request: PosteriorBatchRequest
): PosteriorBatchResponse {
  const result = posteriorBatchResponseSchema.parse(input)
  const fail = () => {
    throw new Error('Invalid adaptive engine posterior response')
  }
  if (result.measurementVersion !== request.measurementVersion) fail()
  if (result.subjects.length !== request.subjects.length) fail()
  const requestById = new Map(
    request.subjects.map((subject) => [subject.localId, subject])
  )
  const levels = new Set(request.scale.levels.map((level) => level.id))
  const seen = new Set<number>()
  for (const subject of result.subjects) {
    const requested = requestById.get(subject.localId)
    if (
      !requested ||
      seen.has(subject.localId) ||
      subject.responseCount !== requested.responses.length
    )
      fail()
    seen.add(subject.localId)
    if (subject.credibleLower > subject.credibleUpper) fail()
    if (
      subject.bandProbabilities.length !== levels.size ||
      new Set(subject.bandProbabilities.map((band) => band.levelId)).size !==
        levels.size ||
      subject.bandProbabilities.some((band) => !levels.has(band.levelId)) ||
      Math.abs(
        subject.bandProbabilities.reduce(
          (sum, band) => sum + band.probability,
          0
        ) - 1
      ) > 1e-6
    )
      fail()
  }
  return result
}
