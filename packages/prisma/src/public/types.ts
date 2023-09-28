type AvatarSettingsPrisma = {
  skinTone: string
  eyes: string
  mouth: string
  hair: string
  accessory: string
  hairColor: string
  clothing: string
  clothingColor: string
  facialHair: string
}

type QuestionResponseChoicesPrisma = {
  choices: number[]
}

type QuestionResponseValuePrisma = {
  value: string
}

type QuestionResponsePrisma =
  | QuestionResponseChoicesPrisma
  | QuestionResponseValuePrisma

type QuestionResultsChoicesPrisma = {
  choices: Record<string, number>
}

type QuestionResultsNumericalPrisma = {
  [x: string]: number
}

type QuestionResultsFreeTextPrisma = {
  [x: string]: number
}

type QuestionResultsPrisma =
  | QuestionResultsChoicesPrisma
  | QuestionResultsNumericalPrisma
  | QuestionResultsFreeTextPrisma

type ChoicePrisma = {
  ix: number
  value: string
  correct?: boolean
  feedback?: string
}

type QuestionOptionsChoicesPrisma = {
  choices: ChoicePrisma[]
}

type QuestionOptionsNumericalPrisma = {
  unit?: string | null
  accuracy?: number
  placeholder?: string
  restrictions?: {
    min?: number
    max?: number
  }
  solutionRanges?: {
    min?: number | null
    max?: number | null
  }[]
}

type QuestionOptionsFreeTextPrisma = {
  solutions?: string[]
  restrictions?: {
    maxLength?: number | null
  }
}

type QuestionOptionsPrisma =
  | QuestionOptionsChoicesPrisma
  | QuestionOptionsNumericalPrisma
  | QuestionOptionsFreeTextPrisma

// interface IQuestionDataPrisma<Type, Options> {
//   id: number
//   name: string
//   type: Type
//   displayMode: QuestionDisplayMode
//   content: string
//   ownerId: string
//   isDeleted: boolean
//   isArchived: boolean
//   createdAt: string | Date
//   updatedAt: string | Date
//   pointsMultiplier: number
//   explanation?: string

//   options: Options
// }

// type ChoicesQuestionDataPrisma = IQuestionDataPrisma<
//   QuestionType.SC | QuestionType.MC | QuestionType.KPRIM,
//   QuestionOptionsChoicesPrisma
// >
// type FreeTextQuestionDataPrisma = IQuestionDataPrisma<
//   QuestionType.FREE_TEXT,
//   QuestionOptionsFreeTextPrisma
// >
// type NumericalQuestionDataPrisma = IQuestionDataPrisma<
//   QuestionType.NUMERICAL,
//   QuestionOptionsNumericalPrisma
// >

// type QuestionDataPrisma =
//   | ChoicesQuestionDataPrisma
//   | FreeTextQuestionDataPrisma
//   | NumericalQuestionDataPrisma

declare global {
  namespace PrismaJson {
    type PrismaAvatarSettings = AvatarSettingsPrisma
    type PrismaQuestionResponse = QuestionResponsePrisma
    type PrismaQuestionOptions = QuestionOptionsPrisma
    type PrismaQuestionResults = QuestionResultsPrisma
    // type PrismaQuestionData = QuestionDataPrisma
  }
}
