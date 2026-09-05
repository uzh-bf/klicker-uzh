import * as DB from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import { z } from 'zod'
import {
  ElementDomainIssueCode,
  isMeaningfulText,
  issue,
  normalizeAuthoredText,
  parseWithDomainErrors,
} from './core.js'

const choiceSchema = z
  .object({
    ix: z.number().int().nonnegative(),
    value: z.string(),
    correct: z.boolean().nullish(),
    feedback: z.string().nullish(),
  })
  .strict()

const choicesOptionsSchema = z
  .object({
    displayMode: z.nativeEnum(DisplayMode),
    hasSampleSolution: z.boolean(),
    hasAnswerFeedbacks: z.boolean(),
    choices: z.array(choiceSchema).min(1),
  })
  .strict()

export function normalizeChoicesOptions(type: DB.ElementType, value: unknown) {
  const parsed = parseWithDomainErrors(choicesOptionsSchema, value)
  const choices = [...parsed.choices].sort((left, right) => left.ix - right.ix)

  if (
    choices.some((choice, index) => choice.ix !== index) ||
    new Set(choices.map((choice) => choice.ix)).size !== choices.length
  ) {
    issue(ElementDomainIssueCode.INVALID_CHOICE_INDEX)
  }

  if (type === DB.ElementType.KPRIM && choices.length !== 4) {
    issue(ElementDomainIssueCode.INVALID_SOLUTION)
  }

  if (parsed.hasSampleSolution) {
    if (choices.some((choice) => typeof choice.correct !== 'boolean')) {
      issue(ElementDomainIssueCode.INVALID_SOLUTION)
    }

    const correctChoices = choices.filter((choice) => choice.correct === true)
    if (type === DB.ElementType.SC && correctChoices.length !== 1) {
      issue(ElementDomainIssueCode.INVALID_SOLUTION)
    }
    if (type === DB.ElementType.MC && correctChoices.length === 0) {
      issue(ElementDomainIssueCode.INVALID_SOLUTION)
    }
  }

  const hasAnswerFeedbacks =
    parsed.hasSampleSolution && parsed.hasAnswerFeedbacks

  for (const [index, choice] of choices.entries()) {
    if (!isMeaningfulText(choice.value)) {
      issue(ElementDomainIssueCode.INVALID_TEXT, ['options', 'choices', index])
    }
    if (
      hasAnswerFeedbacks &&
      (typeof choice.feedback !== 'string' ||
        !isMeaningfulText(choice.feedback))
    ) {
      issue(ElementDomainIssueCode.INVALID_TEXT, [
        'options',
        'choices',
        index,
        'feedback',
      ])
    }
  }

  return {
    displayMode: parsed.displayMode,
    hasSampleSolution: parsed.hasSampleSolution,
    hasAnswerFeedbacks,
    choices: choices.map((choice) => ({
      ix: choice.ix,
      value: normalizeAuthoredText(choice.value),
      correct: parsed.hasSampleSolution ? choice.correct! : undefined,
      feedback: hasAnswerFeedbacks
        ? normalizeAuthoredText(choice.feedback!)
        : undefined,
    })),
  }
}
