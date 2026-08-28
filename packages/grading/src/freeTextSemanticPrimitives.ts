export const SCORE_MIN = 0
export const SCORE_MAX = 100

const FLOAT_TOLERANCE = 1e-9

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  )
}

export function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length
}

export function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= FLOAT_TOLERANCE
}
