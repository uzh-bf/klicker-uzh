export const ElementDisplayMode = {
  Grid: 'GRID',
  List: 'LIST',
} as const

export type ElementDisplayMode =
  (typeof ElementDisplayMode)[keyof typeof ElementDisplayMode]

export const ElementType = {
  CaseStudy: 'CASE_STUDY',
  Content: 'CONTENT',
  Flashcard: 'FLASHCARD',
  FreeText: 'FREE_TEXT',
  Kprim: 'KPRIM',
  Mc: 'MC',
  Numerical: 'NUMERICAL',
  Sc: 'SC',
  Selection: 'SELECTION',
} as const

export type ElementType = (typeof ElementType)[keyof typeof ElementType]

export const FlashcardCorrectness = {
  Correct: 'CORRECT',
  Incorrect: 'INCORRECT',
  Partial: 'PARTIAL',
} as const

export type FlashcardCorrectness =
  (typeof FlashcardCorrectness)[keyof typeof FlashcardCorrectness]

export type InstanceEvaluation = {
  newPointsFrom?: Date | number | string | null
  newXpFrom?: Date | number | string | null
  pointsAwarded?: number | null
  pointsMultiplier?: number | null
  score: number
  xpAwarded?: number | null
}

export type Choice = {
  correct?: boolean | null
  feedback?: string | null
  ix: number
  value: string
}

export type QuestionFeedback = Choice

export type FreeTextElementOptions = {
  restrictions?: {
    maxLength?: number | null
  } | null
  solutions?: string[] | null
}

export type FreeTextInstanceEvaluation = InstanceEvaluation & {
  answers?:
    | {
        count: number
        value: string
      }[]
    | null
  explanation?: string | null
  solutions?: string[] | null
}

export type NumericalElementOptions = {
  restrictions?: {
    max?: number | null
    min?: number | null
  } | null
}

export type ContentElementInstance = {
  elementData: {
    content: string
  }
}

export type SelectionElementOptions = {
  answerCollection?: {
    entries?:
      | {
          id: number
          value: string
        }[]
      | null
  } | null
  numberOfInputs?: number | null
}

export type CaseStudyElementOptions = {
  cases: {
    description: string
    id: string
    title: string
  }[]
  criteria: {
    id: string
    labels?: {
      max: string
      mid?: string | null
      min: string
    } | null
    max: number
    min: number
    name: string
    step: number
    unit?: string | null
  }[]
  items?:
    | {
        id: number
        value: string
      }[]
    | null
}
