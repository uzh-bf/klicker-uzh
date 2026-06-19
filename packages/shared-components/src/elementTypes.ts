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
