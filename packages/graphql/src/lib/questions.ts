import { ElementType } from '@klicker-uzh/prisma'
import {
  AllQuestionTypeData,
  QuestionResults,
  QuestionResultsChoices,
} from '../types/app.js'

export function prepareInitialQuestionInstanceResults(
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
      return { choices, total: 0 } as QuestionResultsChoices
    }

    case ElementType.NUMERICAL:
    case ElementType.FREE_TEXT: {
      return { responses: {}, total: 0 }
    }

    // case ElementType.FLASHCARD:
    // case ElementType.CONTENT: {
    //   return { responses: {}, total: 0 }
    // }

    // ! QuestionInstances do not support Flashcards / Content elements at this point
    // case ElementType.FLASHCARD: {
    //   return {
    //     [FlashcardCorrectness.CORRECT]: 0,
    //     [FlashcardCorrectness.PARTIAL]: 0,
    //     [FlashcardCorrectness.INCORRECT]: 0,
    //     total: 0,
    //   }
    // }

    // case ElementType.CONTENT: {
    //   return { total: 0 }
    // }

    default:
      throw new Error('Unknown question type')
  }
}
