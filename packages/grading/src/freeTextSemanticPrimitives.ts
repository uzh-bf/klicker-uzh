export const SCORE_MIN = 0
export const SCORE_MAX = 100
export const MAX_FREE_TEXT_CONFIG_TEXT_LENGTH = 10_000
export const MAX_FREE_TEXT_IDENTIFIER_LENGTH = 256
export const MAX_FREE_TEXT_LIST_ITEMS = 100
export const MAX_FREE_TEXT_LIST_ITEM_LENGTH = 2_000
export const MAX_FREE_TEXT_RUBRICS = 20
export const MAX_FREE_TEXT_ACHIEVEMENT_LEVELS = 20
export const MAX_FREE_TEXT_OUTCOME_BANDS = 20
export const MAX_FREE_TEXT_EXACT_ANSWERS = 50
const MAX_FREE_TEXT_PAYLOAD_DEPTH = 12
const MAX_FREE_TEXT_OBJECT_ENTRIES = 100

const FLOAT_TOLERANCE = 1e-9

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isBoundedNonEmptyString(
  value: unknown,
  maxLength: number
): value is string {
  return isNonEmptyString(value) && value.length <= maxLength
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  )
}

export function isBoundedStringArray(
  value: unknown,
  { maxItems, maxItemLength }: { maxItems: number; maxItemLength: number }
): value is string[] {
  return (
    isStringArray(value) &&
    value.length <= maxItems &&
    value.every((entry) => entry.length <= maxItemLength)
  )
}

export function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length
}

export function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= FLOAT_TOLERANCE
}

export function isWithinFreeTextPayloadBounds(
  value: unknown,
  depth = 0
): boolean {
  if (depth > MAX_FREE_TEXT_PAYLOAD_DEPTH) return false
  if (typeof value === 'string') {
    return value.length <= MAX_FREE_TEXT_CONFIG_TEXT_LENGTH
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return true
  }
  if (Array.isArray(value)) {
    return (
      value.length <= MAX_FREE_TEXT_LIST_ITEMS &&
      value.every((entry) => isWithinFreeTextPayloadBounds(entry, depth + 1))
    )
  }
  if (!isRecord(value)) return false

  const entries = Object.entries(value)
  return (
    entries.length <= MAX_FREE_TEXT_OBJECT_ENTRIES &&
    entries.every(([key, entry]) => {
      return (
        key.length <= MAX_FREE_TEXT_IDENTIFIER_LENGTH &&
        isWithinFreeTextPayloadBounds(entry, depth + 1)
      )
    })
  )
}
