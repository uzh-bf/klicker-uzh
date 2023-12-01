import { Element, ElementType } from '@klicker-uzh/prisma'
import * as R from 'ramda'
import {
  AllElementTypeData,
  BaseElementDataKeys,
  ChoicesElementData,
  FreeTextElementData,
  NumericalElementData,
  QuestionResults,
  QuestionResultsChoices,
} from '../types/app'

const RELEVANT_KEYS: BaseElementDataKeys = [
  'id',
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'displayMode',
  'hasSampleSolution',
  'hasAnswerFeedbacks',
  'type',
  'options',
]

export function processQuestionData(question: Element) {
  const extractRelevantKeys = R.pick(RELEVANT_KEYS)

  switch (question.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      // TODO: remove the extra keys, once the questionData options are compatible
      return {
        ...extractRelevantKeys(question),
        id: `${question.id}-v${question.version}`,
        questionId: question.id,
        displayMode: question.options.displayMode,
        hasSampleSolution: question.options.hasSampleSolution,
        hasAnswerFeedbacks: question.options.hasAnswerFeedbacks,
      } as ChoicesElementData

    case ElementType.NUMERICAL:
      // TODO: remove the extra keys, once the questionData options are compatible
      return {
        ...extractRelevantKeys(question),
        id: `${question.id}-v${question.version}`,
        questionId: question.id,
        hasSampleSolution: question.options.hasSampleSolution,
        hasAnswerFeedbacks: question.options.hasAnswerFeedbacks,
      } as NumericalElementData

    case ElementType.FREE_TEXT:
      // TODO: remove the extra keys, once the questionData options are compatible
      return {
        ...extractRelevantKeys(question),
        id: `${question.id}-v${question.version}`,
        questionId: question.id,
        hasSampleSolution: question.options.hasSampleSolution,
        hasAnswerFeedbacks: question.options.hasAnswerFeedbacks,
      } as FreeTextElementData

    default:
      throw new Error('Unknown question type')
  }
}

export function prepareInitialInstanceResults(
  questionData: AllElementTypeData
): QuestionResults {
  switch (questionData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      const choices = questionData.options.choices.reduce(
        (acc, _, ix) => ({ ...acc, [ix]: 0 }),
        {}
      )
      return { choices } as QuestionResultsChoices
    }

    case ElementType.NUMERICAL:
    case ElementType.FREE_TEXT: {
      return {}
    }

    default:
      throw new Error('Unknown question type')
  }
}
