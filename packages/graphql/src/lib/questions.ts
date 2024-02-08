import { Element, ElementType } from '@klicker-uzh/prisma'
import * as R from 'ramda'
import {
  AllElementTypeData,
  BaseElementDataKeys,
  FlashcardCorrectness,
  QuestionResults,
  QuestionResultsChoices,
} from '../types/app'

const RELEVANT_KEYS: BaseElementDataKeys = [
  'id',
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
]

export function processQuestionData(question: Element) {
  const extractRelevantKeys = R.pick(RELEVANT_KEYS)

  return {
    ...extractRelevantKeys(question),
    id: `${question.id}-v${question.version}`,
    questionId: question.id,
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
      return { choices, total: 0 } as QuestionResultsChoices
    }

    case ElementType.NUMERICAL:
    case ElementType.FREE_TEXT: {
      return { responses: {}, total: 0 }
    }

    case ElementType.FLASHCARD: {
      return {
        [FlashcardCorrectness.CORRECT]: 0,
        [FlashcardCorrectness.PARTIAL]: 0,
        [FlashcardCorrectness.INCORRECT]: 0,
        total: 0,
      }
    }

    case ElementType.CONTENT: {
      return {}
    }

    default:
      throw new Error('Unknown question type')
  }
}
