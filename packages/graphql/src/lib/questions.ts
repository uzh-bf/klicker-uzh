import { Question, QuestionType } from '@klicker-uzh/prisma'
import {
  AllQuestionTypeData,
  ChoicesQuestionData,
  FreeTextQuestionData,
  NumericalQuestionData,
  QuestionResults,
  QuestionResultsChoices,
} from 'src/types/app'

export function processQuestionData(question: Question) {
  switch (question.type) {
    case QuestionType.SC:
    case QuestionType.MC:
    case QuestionType.KPRIM:
      return { ...question } as ChoicesQuestionData

    case QuestionType.NUMERICAL:
      return { ...question } as NumericalQuestionData

    case QuestionType.FREE_TEXT:
      return { ...question } as FreeTextQuestionData

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
