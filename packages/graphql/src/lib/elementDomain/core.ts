import { z } from 'zod'

export const ELEMENT_DOMAIN_LIMITS = {
  pointsMultiplierMin: 1,
  pointsMultiplierMax: 4,
  numericalMin: -1e30,
  numericalMax: 1e30,
  numericalAccuracyMax: 100,
} as const

export const ElementDomainIssueCode = {
  INVALID_SHAPE: 'ELEMENT_INVALID_SHAPE',
  INVALID_TEXT: 'ELEMENT_INVALID_TEXT',
  INVALID_CHOICE_INDEX: 'ELEMENT_INVALID_CHOICE_INDEX',
  INVALID_SOLUTION: 'ELEMENT_INVALID_SOLUTION',
  INVALID_NUMERICAL_BOUNDS: 'ELEMENT_INVALID_NUMERICAL_BOUNDS',
  INVALID_RELATION: 'ELEMENT_INVALID_RELATION',
  INVALID_CASE_STUDY: 'ELEMENT_INVALID_CASE_STUDY',
} as const

export type ElementDomainIssueCode =
  (typeof ElementDomainIssueCode)[keyof typeof ElementDomainIssueCode]

export type ElementDomainIssue = {
  code: ElementDomainIssueCode
  path: readonly (string | number)[]
}

export class ElementDomainValidationError extends Error {
  readonly code = 'ELEMENT_OPTIONS_INVALID'

  constructor(readonly issues: readonly ElementDomainIssue[]) {
    super('Element configuration is invalid.')
    this.name = 'ElementDomainValidationError'
  }
}

export type ElementReference = string | number

export type ElementRelationContext<Id extends ElementReference> = {
  answerCollectionId?: Id
  poolIds?: readonly Id[]
  selectedIds?: readonly Id[]
  caseSolutionReferenceKey?: 'itemId' | 'itemRef'
}

export const reservedIdentifiers = new Set([
  '__proto__',
  'prototype',
  'constructor',
])

export const finiteNumericalValueSchema = z
  .number()
  .finite()
  .min(ELEMENT_DOMAIN_LIMITS.numericalMin)
  .max(ELEMENT_DOMAIN_LIMITS.numericalMax)

export function issue(
  code: ElementDomainIssueCode,
  path: readonly (string | number)[] = ['options']
): never {
  throw new ElementDomainValidationError([{ code, path }])
}

export function parseWithDomainErrors<T>(
  schema: z.ZodType<T>,
  value: unknown
): T {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data

  throw new ElementDomainValidationError(
    parsed.error.issues.map((entry) => ({
      code: ElementDomainIssueCode.INVALID_SHAPE,
      path: ['options', ...entry.path],
    }))
  )
}

export function isMeaningfulText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 && !/^(?:<br\s*\/?>\s*)+$/iu.test(trimmed)
}

export function normalizePlainText(value: string) {
  return value.normalize('NFC').trim()
}

export function normalizeAuthoredText(value: string) {
  return value.normalize('NFC')
}

export function normalizeOptionalPlainText(value?: string | null) {
  if (typeof value !== 'string') return undefined
  const normalized = normalizePlainText(value)
  return normalized.length > 0 ? normalized : undefined
}

export function normalizeNumber(value: number) {
  return Object.is(value, -0) ? 0 : value
}

export function assertOrderedBounds(
  bounds: { min?: number | null; max?: number | null },
  path: readonly (string | number)[]
) {
  if (
    typeof bounds.min === 'number' &&
    typeof bounds.max === 'number' &&
    bounds.min > bounds.max
  ) {
    issue(ElementDomainIssueCode.INVALID_NUMERICAL_BOUNDS, path)
  }
}

export function assertUniqueIdentifiers(
  values: readonly ElementReference[],
  path: readonly (string | number)[]
) {
  if (new Set(values).size !== values.length) {
    issue(ElementDomainIssueCode.INVALID_RELATION, path)
  }
}
