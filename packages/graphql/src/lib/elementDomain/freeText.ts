import { z } from 'zod'
import {
  ElementDomainIssueCode,
  isMeaningfulText,
  issue,
  parseWithDomainErrors,
} from './core.js'

const freeTextOptionsSchema = z
  .object({
    hasSampleSolution: z.boolean(),
    restrictions: z
      .object({
        maxLength: z.number().int().positive().nullish(),
      })
      .strict()
      .nullish(),
    solutions: z.array(z.string()).nullish(),
  })
  .strict()

export function normalizeFreeTextOptions(value: unknown) {
  const parsed = parseWithDomainErrors(freeTextOptionsSchema, value)
  const maxLength = parsed.restrictions?.maxLength ?? undefined
  const solutions = (parsed.solutions ?? []).map((solution, index) => {
    // Preserve the exact Unicode representation because the free-text grader
    // currently treats canonically equivalent strings as distinct answers.
    const normalized = solution.trim()
    if (!isMeaningfulText(normalized)) {
      issue(ElementDomainIssueCode.INVALID_SOLUTION, [
        'options',
        'solutions',
        index,
      ])
    }
    if (typeof maxLength === 'number' && normalized.length > maxLength) {
      issue(ElementDomainIssueCode.INVALID_SOLUTION, [
        'options',
        'solutions',
        index,
      ])
    }
    return normalized
  })

  if (parsed.hasSampleSolution && solutions.length === 0) {
    issue(ElementDomainIssueCode.INVALID_SOLUTION)
  }

  return {
    hasSampleSolution: parsed.hasSampleSolution,
    solutions: parsed.hasSampleSolution ? solutions : undefined,
    restrictions: { maxLength },
  }
}
