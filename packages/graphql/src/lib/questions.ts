import { Element, ElementType } from '@klicker-uzh/prisma'
import * as R from 'ramda'
import {
  AllQuestionTypeData,
  BaseQuestionDataKeys,
  ChoicesQuestionData,
  FreeTextQuestionData,
  NumericalQuestionData,
  QuestionResults,
  QuestionResultsChoices,
} from 'src/types/app'

const RELEVANT_KEYS: BaseQuestionDataKeys = [
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
        displayMode: question.options.displayMode,
        hasSampleSolution: question.options.hasSampleSolution,
        hasAnswerFeedbacks: question.options.hasAnswerFeedbacks,
      } as ChoicesQuestionData

    case ElementType.NUMERICAL:
      // TODO: remove the extra keys, once the questionData options are compatible
      return {
        ...extractRelevantKeys(question),
        hasSampleSolution: question.options.hasSampleSolution,
        hasAnswerFeedbacks: question.options.hasAnswerFeedbacks,
      } as NumericalQuestionData

    case ElementType.FREE_TEXT:
      // TODO: remove the extra keys, once the questionData options are compatible
      return {
        ...extractRelevantKeys(question),
        hasSampleSolution: question.options.hasSampleSolution,
        hasAnswerFeedbacks: question.options.hasAnswerFeedbacks,
      } as FreeTextQuestionData

    default:
      throw new Error('Unknown question type')
  }
}

export function prepareInitialInstanceResults(
  questionData: AllQuestionTypeData
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
