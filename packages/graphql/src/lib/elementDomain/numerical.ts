import { z } from 'zod'
import {
  assertOrderedBounds,
  ELEMENT_DOMAIN_LIMITS,
  ElementDomainIssueCode,
  finiteNumericalValueSchema,
  issue,
  normalizeNumber,
  normalizeOptionalPlainText,
  parseWithDomainErrors,
} from './core.js'

const optionalFiniteNumericalValueSchema = finiteNumericalValueSchema.nullish()

const numericalBoundsSchema = z
  .object({
    min: optionalFiniteNumericalValueSchema,
    max: optionalFiniteNumericalValueSchema,
  })
  .strict()

const numericalOptionsSchema = z
  .object({
    hasSampleSolution: z.boolean(),
    unit: z.string().nullish(),
    accuracy: z
      .number()
      .int()
      .nonnegative()
      .max(ELEMENT_DOMAIN_LIMITS.numericalAccuracyMax)
      .nullish(),
    placeholder: z.string().nullish(),
    restrictions: numericalBoundsSchema.nullish(),
    solutionRanges: z.array(numericalBoundsSchema).nullish(),
    exactSolutions: z.array(finiteNumericalValueSchema).nullish(),
  })
  .strict()

export function normalizeNumericalOptions(value: unknown) {
  const parsed = parseWithDomainErrors(numericalOptionsSchema, value)
  const restrictions = {
    min:
      typeof parsed.restrictions?.min === 'number'
        ? normalizeNumber(parsed.restrictions.min)
        : undefined,
    max:
      typeof parsed.restrictions?.max === 'number'
        ? normalizeNumber(parsed.restrictions.max)
        : undefined,
  }
  assertOrderedBounds(restrictions, ['options', 'restrictions'])

  const solutionRanges = (parsed.solutionRanges ?? []).map((range, index) => {
    const normalized = {
      min:
        typeof range.min === 'number' ? normalizeNumber(range.min) : undefined,
      max:
        typeof range.max === 'number' ? normalizeNumber(range.max) : undefined,
    }
    if (
      typeof normalized.min === 'undefined' &&
      typeof normalized.max === 'undefined'
    ) {
      issue(ElementDomainIssueCode.INVALID_SOLUTION, [
        'options',
        'solutionRanges',
        index,
      ])
    }
    assertOrderedBounds(normalized, ['options', 'solutionRanges', index])
    return normalized
  })
  const exactSolutions = (parsed.exactSolutions ?? []).map(normalizeNumber)

  if (parsed.hasSampleSolution) {
    const hasRanges = solutionRanges.length > 0
    const hasExactSolutions = exactSolutions.length > 0
    if (hasRanges === hasExactSolutions) {
      issue(ElementDomainIssueCode.INVALID_SOLUTION)
    }

    const belowMinimum = (candidate: number) =>
      typeof restrictions.min === 'number' && candidate < restrictions.min
    const aboveMaximum = (candidate: number) =>
      typeof restrictions.max === 'number' && candidate > restrictions.max

    if (
      exactSolutions.some(
        (solution) => belowMinimum(solution) || aboveMaximum(solution)
      ) ||
      solutionRanges.some(
        (range) =>
          (typeof range.min === 'number' &&
            (belowMinimum(range.min) || aboveMaximum(range.min))) ||
          (typeof range.max === 'number' &&
            (belowMinimum(range.max) || aboveMaximum(range.max)))
      )
    ) {
      issue(ElementDomainIssueCode.INVALID_NUMERICAL_BOUNDS)
    }
  }

  return {
    hasSampleSolution: parsed.hasSampleSolution,
    unit: normalizeOptionalPlainText(parsed.unit),
    accuracy: parsed.accuracy ?? undefined,
    placeholder: normalizeOptionalPlainText(parsed.placeholder),
    restrictions,
    solutionRanges:
      parsed.hasSampleSolution && solutionRanges.length > 0
        ? solutionRanges
        : undefined,
    exactSolutions:
      parsed.hasSampleSolution && exactSolutions.length > 0
        ? exactSolutions
        : undefined,
  }
}
