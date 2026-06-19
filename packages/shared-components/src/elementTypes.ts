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
}

export type NumericalElementOptions = {
  restrictions?: {
    max?: number | null
    min?: number | null
  } | null
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
