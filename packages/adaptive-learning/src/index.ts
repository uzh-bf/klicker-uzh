export const DEFAULT_THETA_RANGE = { min: -3, max: 3 } as const
export const DEFAULT_DISCRIMINATION = 1.5
export const DEFAULT_STANDARD_ERROR_THRESHOLD = 0.4
export const DEFAULT_QUESTION_THRESHOLD = 50
export const DEFAULT_TOP_INFORMATION_RATIO = 0.8

const EPSILON = 1e-9

export type ThetaRange = {
  min: number
  max: number
}

export type AdaptiveItemType = 'SC' | 'MC' | 'KPRIM' | 'FREE_TEXT'

export type LevelDefinition = {
  label: string
  order: number
}

export type MappedLevel = LevelDefinition & {
  theta: number
  lowerBound: number
  upperBound: number
}

export type AdaptiveItem = {
  id: number | string
  type?: AdaptiveItemType
  a?: number
  b: number
  c?: number
  choiceCount?: number
  enabled?: boolean
  exposure?: number
  competenceId?: string
  subCompetenceId?: string
  levelLabel?: string
}

export type AdaptiveResponse = {
  item: AdaptiveItem
  correct: boolean
}

export type KnowledgeState = {
  theta: number
  standardError: number
}

export type SubCompetenceCandidate = {
  competenceId: string
  subCompetenceId: string
  enabled: boolean
  answeredQuestions?: number
  questionThreshold?: number | null
  stopped?: boolean
  coverage?: number
  levelThetas?: number[]
}

export type EstimateEntry = {
  theta: number
  standardError: number
  weight?: number
}

export type ResultMessageRule = {
  order: number
  message: string
  isFallback?: boolean
  levelLabel?: string | null
  minTheta?: number | null
  maxTheta?: number | null
}

export function clamp(value: number, range: ThetaRange = DEFAULT_THETA_RANGE) {
  return Math.min(range.max, Math.max(range.min, value))
}

export function mapLevelsToTheta(
  levels: LevelDefinition[],
  range: ThetaRange = DEFAULT_THETA_RANGE
): MappedLevel[] {
  const ordered = levels.slice().sort((a, b) => a.order - b.order)
  const span = range.max - range.min

  return ordered.map((level, index) => {
    const denominator = Math.max(ordered.length - 1, 1)
    const theta = range.min + (span * index) / denominator
    const lowerBound =
      index === 0
        ? Number.NEGATIVE_INFINITY
        : (theta + (range.min + (span * (index - 1)) / denominator)) / 2
    const upperBound =
      index === ordered.length - 1
        ? Number.POSITIVE_INFINITY
        : (theta + (range.min + (span * (index + 1)) / denominator)) / 2

    return {
      ...level,
      theta,
      lowerBound,
      upperBound,
    }
  })
}

export function mapThetaToLevel(
  theta: number,
  levels: LevelDefinition[],
  range: ThetaRange = DEFAULT_THETA_RANGE
) {
  const mappedLevels = mapLevelsToTheta(levels, range)
  return (
    mappedLevels.find(
      (level) => theta >= level.lowerBound && theta < level.upperBound
    ) ?? mappedLevels.at(-1)
  )
}

export function deriveGuessingParameter({
  type,
  choiceCount,
}: {
  type: AdaptiveItemType
  choiceCount?: number | null
}) {
  if (type === 'SC') return 1 / Math.max(choiceCount ?? 4, 2)
  if (type === 'MC') return 1 / (Math.pow(2, Math.max(choiceCount ?? 4, 1)) - 1)
  if (type === 'KPRIM') return 1 / Math.pow(2, Math.max(choiceCount ?? 4, 1))
  return 0.01
}

export function probability(
  theta: number,
  item: Pick<AdaptiveItem, 'a' | 'b' | 'c'>
) {
  const a = item.a ?? DEFAULT_DISCRIMINATION
  const c = item.c ?? 0
  const exponent = -a * (theta - item.b)
  const logistic = 1 / (1 + Math.exp(exponent))
  return clampProbability(c + (1 - c) * logistic)
}

export function information(
  theta: number,
  item: Pick<AdaptiveItem, 'a' | 'b' | 'c'>
) {
  const a = item.a ?? DEFAULT_DISCRIMINATION
  const c = item.c ?? 0
  const p = probability(theta, item)
  const q = 1 - p
  const numerator = Math.pow(a, 2) * q * Math.pow(p - c, 2)
  const denominator = Math.max(Math.pow(1 - c, 2) * p, EPSILON)

  return Math.max(0, numerator / denominator)
}

export function standardError(
  theta: number,
  items: Array<Pick<AdaptiveItem, 'a' | 'b' | 'c'>>
) {
  const totalInformation = items.reduce(
    (sum, item) => sum + information(theta, item),
    0
  )

  return totalInformation > 0 ? 1 / Math.sqrt(totalInformation) : Infinity
}

export function updateTheta({
  responses,
  range = DEFAULT_THETA_RANGE,
  initialTheta,
  priorMean = 0,
  priorSD = 1,
  usePrior = false,
  maxIterations = 10,
  tolerance = 1e-3,
}: {
  responses: AdaptiveResponse[]
  range?: ThetaRange
  initialTheta?: number
  priorMean?: number
  priorSD?: number
  usePrior?: boolean
  maxIterations?: number
  tolerance?: number
}): KnowledgeState {
  const startTheta = clamp(initialTheta ?? priorMean, range)

  if (responses.length === 0) {
    return {
      theta: startTheta,
      standardError: standardError(startTheta, []),
    }
  }

  let theta = startTheta
  const priorVariance = Math.pow(priorSD, 2)

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let score = 0
    let totalInformation = 0

    for (const response of responses) {
      const p = probability(theta, response.item)
      const derivative = probabilityDerivative(theta, response.item)
      const u = response.correct ? 1 : 0

      score += (u - p) * (derivative / Math.max(p * (1 - p), EPSILON))
      totalInformation += information(theta, response.item)
    }

    if (usePrior && priorVariance > 0) {
      score += -(theta - priorMean) / priorVariance
      totalInformation += 1 / priorVariance
    }

    if (totalInformation <= EPSILON) break

    const nextTheta = clamp(theta + score / totalInformation, range)

    if (Math.abs(nextTheta - theta) < tolerance) {
      theta = nextTheta
      break
    }

    theta = nextTheta
  }

  const items = responses.map((response) => response.item)
  const roundedTheta = clamp(Number(theta.toFixed(4)), range)

  return {
    theta: roundedTheta,
    standardError: standardError(roundedTheta, items),
  }
}

export function getKnowledgeState({
  responses,
  range = DEFAULT_THETA_RANGE,
}: {
  responses: AdaptiveResponse[]
  range?: ThetaRange
}) {
  return updateTheta({ responses, range })
}

export function shouldStop({
  answeredQuestions,
  questionThreshold = DEFAULT_QUESTION_THRESHOLD,
  standardError,
  standardErrorThreshold = DEFAULT_STANDARD_ERROR_THRESHOLD,
}: {
  answeredQuestions: number
  questionThreshold?: number
  standardError: number
  standardErrorThreshold?: number
}) {
  return (
    answeredQuestions >= questionThreshold ||
    standardError <= standardErrorThreshold
  )
}

export function selectSubCompetence({
  candidates,
  random = Math.random,
}: {
  candidates: SubCompetenceCandidate[]
  random?: () => number
}) {
  const eligible = candidates.filter((candidate) => {
    if (!candidate.enabled || candidate.stopped) return false
    if (
      candidate.questionThreshold != null &&
      (candidate.answeredQuestions ?? 0) >= candidate.questionThreshold
    ) {
      return false
    }
    return true
  })

  if (eligible.length === 0) return null

  const weighted = computeSubCompetenceCoverageWeights(eligible)
  const maxWeight = Math.max(...weighted.map((entry) => entry.weight))
  const ties = weighted
    .filter((entry) => entry.weight === maxWeight)
    .map((entry) => entry.candidate)

  return ties[Math.floor(random() * ties.length)] ?? ties[0] ?? null
}

export function computeSubCompetenceCoverageWeights(
  candidates: SubCompetenceCandidate[]
) {
  const withCoverage = candidates.map((candidate) => ({
    candidate,
    coverage: Math.max(0, computeCoverage(candidate)),
  }))
  const totalCoverage = withCoverage.reduce(
    (sum, entry) => sum + entry.coverage,
    0
  )

  return withCoverage.map((entry) => ({
    ...entry,
    weight:
      totalCoverage > 0
        ? entry.coverage / totalCoverage
        : 1 / Math.max(withCoverage.length, 1),
  }))
}

export function selectNextItem({
  theta,
  items,
  answeredItemIds = new Set(),
  random = Math.random,
}: {
  theta: number
  items: AdaptiveItem[]
  answeredItemIds?: Set<number | string>
  random?: () => number
}) {
  const activeItems = items.filter((item) => item.enabled !== false)
  const pool = activeItems.filter((item) => !answeredItemIds.has(item.id))

  if (pool.length === 0) return null

  const scored = pool.map((item) => ({
    item,
    information: information(theta, item),
  }))
  const maxInformation = Math.max(...scored.map((entry) => entry.information))
  const ties = scored
    .filter((entry) => entry.information === maxInformation)
    .map((entry) => entry.item)

  return ties[Math.floor(random() * ties.length)] ?? null
}

export function aggregateInverseVariance(entries: EstimateEntry[]) {
  const usable = entries.filter(
    (entry) => Number.isFinite(entry.standardError) && entry.standardError > 0
  )

  if (usable.length === 0) return null

  const weighted = usable.map((entry) => {
    const precision = 1 / Math.pow(entry.standardError, 2)
    return {
      theta: entry.theta,
      weight: precision * (entry.weight ?? 1),
    }
  })
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0)

  return {
    theta:
      weighted.reduce((sum, entry) => sum + entry.theta * entry.weight, 0) /
      totalWeight,
    standardError: Math.sqrt(1 / totalWeight),
  }
}

export function aggregateWeightedEstimates(entries: EstimateEntry[]) {
  const usable = entries.filter(
    (entry) =>
      Number.isFinite(entry.theta) &&
      Number.isFinite(entry.standardError) &&
      entry.standardError > 0
  )

  if (usable.length === 0) return null

  const rawWeights = usable.map((entry) => Math.max(0, entry.weight ?? 1))
  const rawWeightSum = rawWeights.reduce((sum, weight) => sum + weight, 0)
  const weights =
    rawWeightSum > 0
      ? rawWeights.map((weight) => weight / rawWeightSum)
      : usable.map(() => 1 / usable.length)

  const theta = usable.reduce(
    (sum, entry, index) => sum + entry.theta * weights[index]!,
    0
  )
  const variance = usable.reduce(
    (sum, entry, index) =>
      sum + Math.pow(weights[index]!, 2) * Math.pow(entry.standardError, 2),
    0
  )

  return {
    theta,
    standardError: Math.sqrt(variance),
  }
}

export function matchResultMessage({
  theta,
  levelLabel,
  rules,
}: {
  theta: number
  levelLabel?: string | null
  rules: ResultMessageRule[]
}) {
  return matchResultMessages({ theta, levelLabel, rules })[0] ?? null
}

export function matchResultMessages({
  theta,
  levelLabel,
  rules,
}: {
  theta: number
  levelLabel?: string | null
  rules: ResultMessageRule[]
}) {
  const orderedRules = rules.slice().sort((a, b) => a.order - b.order)
  const primaryRule = orderedRules.find(
    (rule) =>
      !rule.isFallback &&
      !isOptionalIntervalMessage(rule) &&
      resultMessageRuleMatches({ rule, theta, levelLabel })
  )
  const optionalRules = orderedRules.filter(
    (rule) =>
      !rule.isFallback &&
      isOptionalIntervalMessage(rule) &&
      resultMessageRuleMatches({ rule, theta, levelLabel })
  )
  const fallbackRule = orderedRules.find((rule) => rule.isFallback)

  const messages = [
    primaryRule?.message ?? fallbackRule?.message,
    ...optionalRules.map((rule) => rule.message),
  ].filter((message): message is string => typeof message === 'string')

  return [...new Set(messages)]
}

function resultMessageRuleMatches({
  rule,
  theta,
  levelLabel,
}: {
  rule: ResultMessageRule
  theta: number
  levelLabel?: string | null
}) {
  if (rule.levelLabel && rule.levelLabel !== levelLabel) return false
  if (rule.minTheta != null && theta < rule.minTheta) return false
  if (rule.maxTheta != null && theta > rule.maxTheta) return false
  return true
}

function isOptionalIntervalMessage(rule: ResultMessageRule) {
  return !rule.levelLabel && (rule.minTheta != null || rule.maxTheta != null)
}

export function validateEnabledStructure(
  competences: {
    enabled: boolean
    subCompetences: { enabled: boolean }[]
  }[]
) {
  const enabledCompetences = competences.filter(
    (competence) => competence.enabled
  )

  if (enabledCompetences.length === 0) {
    return {
      valid: false,
      message: 'At least one competence must be enabled.',
    }
  }

  const invalidCompetence = enabledCompetences.find(
    (competence) =>
      !competence.subCompetences.some((subCompetence) => subCompetence.enabled)
  )

  if (invalidCompetence) {
    return {
      valid: false,
      message:
        'Every enabled competence must have at least one enabled subcompetence.',
    }
  }

  return { valid: true, message: null }
}

function computeCoverage(candidate: SubCompetenceCandidate) {
  if (typeof candidate.coverage === 'number') return candidate.coverage

  const sortedThetas = [...new Set(candidate.levelThetas ?? [])].sort(
    (a, b) => a - b
  )
  if (sortedThetas.length <= 1) return sortedThetas.length

  return (sortedThetas.at(-1) ?? 0) - (sortedThetas[0] ?? 0)
}

function clampProbability(value: number) {
  return Math.min(1 - EPSILON, Math.max(EPSILON, value))
}

function probabilityDerivative(
  theta: number,
  item: Pick<AdaptiveItem, 'a' | 'b' | 'c'>
) {
  const a = item.a ?? DEFAULT_DISCRIMINATION
  const c = item.c ?? 0
  const exponent = -a * (theta - item.b)
  const exp = Math.exp(exponent)

  return ((1 - c) * a * exp) / Math.pow(1 + exp, 2)
}
