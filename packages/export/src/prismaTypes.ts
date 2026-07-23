import type {
  ElementData,
  SingleQuestionResponseLiveQuiz,
} from '@klicker-uzh/types'

declare global {
  namespace PrismaJson {
    type PrismaElementData = ElementData
    type PrismaSingleQuestionResponseLiveQuiz =
      SingleQuestionResponseLiveQuiz | null
  }
}
