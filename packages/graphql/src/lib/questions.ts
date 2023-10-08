import { Question, QuestionType } from '@klicker-uzh/prisma'
import * as R from 'ramda'
import {
  AllQuestionTypeData,
  ChoicesQuestionData,
  FreeTextQuestionData,
  NumericalQuestionData,
  QuestionResults,
  QuestionResultsChoices,
} from '../types/app'

const extractRelevantKeys = R.pick([
  'id',
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'displayMode',
  'hasSampleSolution',
  'hasAnswerFeedbacks',
  'options',
  'type',
])

export function processQuestionData(question: Question) {
  switch (question.type) {
    case QuestionType.SC:
    case QuestionType.MC:
    case QuestionType.KPRIM:
      return { ...extractRelevantKeys(question) } as ChoicesQuestionData

    case QuestionType.NUMERICAL:
      return { ...extractRelevantKeys(question) } as NumericalQuestionData

    case QuestionType.FREE_TEXT:
      return { ...extractRelevantKeys(question) } as FreeTextQuestionData

    default:
      throw new Error('Unknown question type')
  }
}

export function prepareInitialInstanceResults(
  questionData: AllQuestionTypeData
): QuestionResults {
  switch (questionData.type) {
    case QuestionType.SC:
    case QuestionType.MC:
    case QuestionType.KPRIM: {
      const choices = questionData.options.choices.reduce(
        (acc, _, ix) => ({ ...acc, [ix]: 0 }),
        {}
      )
      return { choices } as QuestionResultsChoices
    }

    case QuestionType.NUMERICAL:
    case QuestionType.FREE_TEXT: {
      return {}
    }

    default:
      throw new Error('Unknown question type')
  }
}
