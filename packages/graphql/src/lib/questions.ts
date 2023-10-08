import { Question, QuestionType } from '@klicker-uzh/prisma'
import * as R from 'ramda'
import {
  AllQuestionTypeData,
  ChoicesQuestionData,
  FreeTextQuestionData,
  NumericalQuestionData,
  QuestionResults,
  QuestionResultsChoices,
} from 'src/types/app'
import { QuestionData } from '../schema/questionData'

const ADDITIONAL_KEYS: string[] = []

export function processQuestionData(question: Question) {
  const extractRelevantKeys = R.pick([
    ...Object.keys(QuestionData),
    ...ADDITIONAL_KEYS,
  ])

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
