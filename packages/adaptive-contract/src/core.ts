export const DEFAULT_THETA_RANGE = { min: -3, max: 3 } as const
export const DEFAULT_DISCRIMINATION = 1.2
export const DEFAULT_TOP_INFORMATION_RATIO = 0.8
export const MAX_COMPETENCE_TREE_DEPTH = 5
export const MAX_ABSOLUTE_THETA = 10
export const MAX_DISCRIMINATION = 10

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

export type NormalizeNumericalResponseResult =
  | { value: number; normalized: string; error?: never }
  | { value: null; normalized: null; error: string }

export function normalizeNumericalResponse(
  response: number | string
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
  const parsed = parseNormalizedDecimalOrFraction(withoutGrouping)
  if (parsed == null) {
    return {
      value: null,
      normalized: null,
      error: 'Response is not an unambiguous number.',
    }
  }

  const value = parsed
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
