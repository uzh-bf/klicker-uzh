export const DEFAULT_THETA_RANGE = { min: -3, max: 3 } as const
export const DEFAULT_DISCRIMINATION = 1.2
export const DEFAULT_TOP_INFORMATION_RATIO = 0.8
export const MAX_COMPETENCE_TREE_DEPTH = 5
export const MAX_ABSOLUTE_THETA = 10
export const MAX_DISCRIMINATION = 10

const EPSILON = 1e-9

export const SUPPORTED_ADAPTIVE_ITEM_TYPES = [
  'NUMERICAL',
  'SC',
  'MC',
  'KPRIM',
  'FREE_TEXT',
] as const

export type ThetaRange = {
  min: number
  max: number
}

export type AdaptiveItemType = (typeof SUPPORTED_ADAPTIVE_ITEM_TYPES)[number]

export type LevelMappingRule = 'NEAREST' | 'MASTERY'

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

export type NormalizedAdaptiveEstimate = {
  position: number
  lowerPosition: number
  upperPosition: number
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

export function normalizeThetaForChart(
  theta: number,
  range: ThetaRange = DEFAULT_THETA_RANGE
) {
  const span = range.max - range.min
  if (!Number.isFinite(theta) || !Number.isFinite(span) || span <= 0) {
    throw new TypeError('A finite theta and increasing range are required.')
  }

  return (clamp(theta, range) - range.min) / span
}

export function normalizeAdaptiveEstimateForChart({
  theta,
  standardError,
  range = DEFAULT_THETA_RANGE,
  z = 1.28,
}: {
  theta: number
  standardError: number
  range?: ThetaRange
  z?: number
}): NormalizedAdaptiveEstimate {
  if (
    !Number.isFinite(standardError) ||
    standardError < 0 ||
    !Number.isFinite(z) ||
    z < 0
  ) {
    throw new TypeError(
      'A finite non-negative standard error and z value are required.'
    )
  }

  return {
    position: normalizeThetaForChart(theta, range),
    lowerPosition: normalizeThetaForChart(theta - z * standardError, range),
    upperPosition: normalizeThetaForChart(theta + z * standardError, range),
  }
}

export function mapLevelsToTheta(
  levels: LevelDefinition[],
  range: ThetaRange = DEFAULT_THETA_RANGE,
  mappingRule: LevelMappingRule = 'NEAREST'
): MappedLevel[] {
  const ordered = levels.slice().sort((a, b) => a.order - b.order)
  const span = range.max - range.min

  return ordered.map((level, index) => {
    const isMastery = mappingRule === 'MASTERY' && ordered.length > 1
    const denominator = isMastery
      ? ordered.length
      : Math.max(ordered.length - 1, 1)
    const theta =
      ordered.length === 1
        ? range.min + span / 2
        : range.min + (span * index) / denominator
    const previousTheta = range.min + (span * (index - 1)) / denominator
    const nextTheta = range.min + (span * (index + 1)) / denominator
    const lowerBound =
      index === 0
        ? Number.NEGATIVE_INFINITY
        : isMastery
          ? theta
          : (theta + previousTheta) / 2
    const upperBound =
      index === ordered.length - 1
        ? Number.POSITIVE_INFINITY
        : isMastery
          ? nextTheta
          : (theta + nextTheta) / 2

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
  range: ThetaRange = DEFAULT_THETA_RANGE,
  mappingRule: LevelMappingRule = 'NEAREST'
) {
  const mappedLevels = mapLevelsToTheta(levels, range, mappingRule)
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
  if (type === 'MC') return 1 / (2 ** Math.max(choiceCount ?? 4, 1) - 1)
  if (type === 'KPRIM') return 1 / 2 ** Math.max(choiceCount ?? 4, 1)
  return 0
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
  const numerator = a ** 2 * q * (p - c) ** 2
  const denominator = Math.max((1 - c) ** 2 * p, EPSILON)

  return Math.max(0, numerator / denominator)
}

export function standardError(
  theta: number,
  items: Array<Pick<AdaptiveItem, 'a' | 'b' | 'c'>>,
  priorSD?: number
) {
  const totalInformation = items.reduce(
    (sum, item) => sum + information(theta, item),
    0
  )
  const priorInformation =
    typeof priorSD === 'number' && priorSD > 0 ? 1 / priorSD ** 2 : 0
  const effectiveInformation = totalInformation + priorInformation

  return effectiveInformation > 0
    ? 1 / Math.sqrt(effectiveInformation)
    : Infinity
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
      standardError: standardError(
        startTheta,
        [],
        usePrior ? priorSD : undefined
      ),
    }
  }

  let theta = startTheta
  const priorVariance = priorSD ** 2

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
    standardError: standardError(
      roundedTheta,
      items,
      usePrior ? priorSD : undefined
    ),
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
  topInformationRatio,
  topK,
  exposurePenalty = 0,
  random = Math.random,
}: {
  theta: number
  items: AdaptiveItem[]
  answeredItemIds?: Set<number | string>
  topInformationRatio?: number
  topK?: number
  exposurePenalty?: number
  random?: () => number
}) {
  const activeItems = items.filter((item) => item.enabled !== false)
  const pool = activeItems.filter((item) => !answeredItemIds.has(item.id))

  if (pool.length === 0) return null

  const scored = pool.map((item) => ({
    item,
    information:
      information(theta, item) -
      exposurePenalty * Math.max(item.exposure ?? 0, 0),
  }))
  const maxInformation = Math.max(...scored.map((entry) => entry.information))
  const ratio = Math.min(Math.max(topInformationRatio ?? 1, 0), 1)
  const sortedByInformation = scored.sort(
    (a, b) => b.information - a.information
  )
  const sorted =
    ratio < 1 && maxInformation > 0
      ? sortedByInformation.filter(
          (entry) => entry.information >= maxInformation * ratio
        )
      : sortedByInformation
  const candidates =
    typeof topK === 'number' && topK > 0
      ? sorted.slice(0, topK)
      : sorted.filter((entry) =>
          ratio < 1 && maxInformation > 0
            ? true
            : entry.information === maxInformation
        )
  const ties = candidates.map((entry) => entry.item)

  return ties[Math.floor(random() * ties.length)] ?? null
}

export function informationAtDifficulty({
  a = DEFAULT_DISCRIMINATION,
  c = 0,
}: {
  a?: number
  c?: number
}) {
  return (a ** 2 * (1 - c)) / (4 * (1 + c))
}

export function minimumReachableStandardError({
  itemCount,
  a = DEFAULT_DISCRIMINATION,
  c = 0,
}: {
  itemCount: number
  a?: number
  c?: number
}) {
  const totalInformation = itemCount * informationAtDifficulty({ a, c })
  return totalInformation > 0 ? 1 / Math.sqrt(totalInformation) : Infinity
}

export function classificationIntervalWithinLevelBand({
  theta,
  standardError,
  levels,
  range = DEFAULT_THETA_RANGE,
  mappingRule = 'NEAREST',
  z = 1.28,
}: {
  theta: number
  standardError: number
  levels: LevelDefinition[]
  range?: ThetaRange
  mappingRule?: LevelMappingRule
  z?: number
}) {
  if (!Number.isFinite(standardError) || standardError < 0) return false

  const lower = theta - z * standardError
  const upper = theta + z * standardError
  const mappedLevels = mapLevelsToTheta(levels, range, mappingRule)

  return mappedLevels.some(
    (level) => lower >= level.lowerBound && upper < level.upperBound
  )
}

export function isNearLevelBoundary({
  theta,
  levels,
  range = DEFAULT_THETA_RANGE,
  mappingRule = 'NEAREST',
  margin,
}: {
  theta: number
  levels: LevelDefinition[]
  range?: ThetaRange
  mappingRule?: LevelMappingRule
  margin: number
}) {
  const boundaries = mapLevelsToTheta(levels, range, mappingRule)
    .flatMap((level) => [level.lowerBound, level.upperBound])
    .filter((boundary) => Number.isFinite(boundary))

  return boundaries.some((boundary) => Math.abs(theta - boundary) <= margin)
}

export type NormalizeNumericalResponseResult =
  | { value: number; normalized: string; error?: never }
  | { value: null; normalized: null; error: string }

export function normalizeNumericalResponse(
  response: number | string,
  { allowPercentInput = false }: { allowPercentInput?: boolean } = {}
): NormalizeNumericalResponseResult {
  if (typeof response === 'number') {
    return Number.isFinite(response)
      ? { value: response, normalized: String(response) }
      : { value: null, normalized: null, error: 'Response is not finite.' }
  }

  const raw = response.trim()
  if (raw.length === 0) {
    return { value: null, normalized: null, error: 'Response is empty.' }
  }

  const minusNormalized = raw.replace(/[\u2212\u2012\u2013\u2014]/g, '-')
  const withoutGrouping = minusNormalized.replace(/[\s']/g, '')
  const hasPercent = withoutGrouping.endsWith('%')
  const numericInput = hasPercent
    ? withoutGrouping.slice(0, -1)
    : withoutGrouping

  if (hasPercent && !allowPercentInput) {
    return {
      value: null,
      normalized: null,
      error: 'Percent input is not enabled for this element.',
    }
  }

  const parsed = parseNormalizedDecimalOrFraction(numericInput)
  if (parsed == null) {
    return {
      value: null,
      normalized: null,
      error: 'Response is not an unambiguous number.',
    }
  }

  const value = hasPercent ? parsed / 100 : parsed
  return { value, normalized: String(value) }
}

export function normalizeFreeTextResponse(response: string) {
  return response
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function aggregateInverseVariance(entries: EstimateEntry[]) {
  const usable = entries.filter(
    (entry) =>
      Number.isFinite(entry.theta) &&
      Number.isFinite(entry.standardError) &&
      entry.standardError > 0 &&
      Number.isFinite(entry.weight ?? 1) &&
      (entry.weight ?? 1) > 0
  )

  if (usable.length === 0) return null

  const weighted = usable.map((entry) => ({
    theta: entry.theta,
    logWeight: Math.log(entry.weight ?? 1) - 2 * Math.log(entry.standardError),
  }))
  const maximumLogWeight = weighted.reduce(
    (maximum, { logWeight }) => Math.max(maximum, logWeight),
    Number.NEGATIVE_INFINITY
  )
  const scaled = weighted.map((entry) => ({
    theta: entry.theta,
    weight: Math.exp(entry.logWeight - maximumLogWeight),
  }))
  const scaledWeightSum = scaled.reduce((sum, entry) => sum + entry.weight, 0)
  const theta =
    scaled.reduce((sum, entry) => sum + entry.theta * entry.weight, 0) /
    scaledWeightSum
  const standardError =
    Math.exp(-maximumLogWeight / 2) / Math.sqrt(scaledWeightSum)

  if (!Number.isFinite(theta) || !Number.isFinite(standardError)) return null

  return {
    theta,
    standardError: Math.max(Number.MIN_VALUE, standardError),
  }
}

export function aggregateWeightedEstimates(entries: EstimateEntry[]) {
  const usable = entries.filter(
    (entry) =>
      Number.isFinite(entry.theta) &&
      Number.isFinite(entry.standardError) &&
      entry.standardError > 0 &&
      Number.isFinite(entry.weight ?? 1) &&
      (entry.weight ?? 1) >= 0
  )

  if (usable.length === 0) return null

  const rawWeights = usable.map((entry) => entry.weight ?? 1)
  const maximumWeight = rawWeights.reduce(
    (maximum, weight) => Math.max(maximum, weight),
    Number.NEGATIVE_INFINITY
  )
  const scaledWeights =
    maximumWeight > 0
      ? rawWeights.map((weight) => weight / maximumWeight)
      : rawWeights
  const scaledWeightSum = scaledWeights.reduce((sum, weight) => sum + weight, 0)
  if (!(scaledWeightSum > 0)) return null
  const weights = scaledWeights.map((weight) => weight / scaledWeightSum)

  const theta = usable.reduce(
    (sum, entry, index) => sum + entry.theta * weights[index]!,
    0
  )
  const standardError = usable.reduce(
    (combined, entry, index) =>
      Math.hypot(combined, weights[index]! * entry.standardError),
    0
  )
  if (!Number.isFinite(theta) || !Number.isFinite(standardError)) return null

  return {
    theta,
    standardError,
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

function parseNormalizedDecimalOrFraction(input: string) {
  const fractionParts = input.split('/')
  if (fractionParts.length === 2) {
    const numerator = parseNormalizedDecimal(fractionParts[0]!)
    const denominator = parseNormalizedDecimal(fractionParts[1]!)

    if (numerator == null || denominator == null || denominator === 0) {
      return null
    }

    return numerator / denominator
  }

  if (fractionParts.length > 2) return null

  return parseNormalizedDecimal(input)
}

function parseNormalizedDecimal(input: string) {
  if (input.includes(',') && input.includes('.')) return null
  if (hasAmbiguousSingleComma(input)) return null

  const normalized = input.includes(',') ? input.replace(',', '.') : input
  const decimalPattern = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:e[+-]?\d+)?$/i
  if (!decimalPattern.test(normalized)) return null

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function hasAmbiguousSingleComma(input: string) {
  const commaCount = input.split(',').length - 1
  if (commaCount !== 1) return false

  const match = input.match(/^[+-]?(\d*),\d{3}(?:e[+-]?\d+)?$/i)
  if (!match) return false

  const integerPart = match[1] ?? ''
  return integerPart.length > 0 && !/^0+$/.test(integerPart)
}

function probabilityDerivative(
  theta: number,
  item: Pick<AdaptiveItem, 'a' | 'b' | 'c'>
) {
  const a = item.a ?? DEFAULT_DISCRIMINATION
  const c = item.c ?? 0
  const exponent = -a * (theta - item.b)
  const exp = Math.exp(exponent)

  return ((1 - c) * a * exp) / (1 + exp) ** 2
}
