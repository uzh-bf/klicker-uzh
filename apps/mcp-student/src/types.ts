export const SUPPORTED_ELEMENT_TYPES = [
  'SC',
  'MC',
  'KPRIM',
  'NUMERICAL',
  'FREE_TEXT',
  'FLASHCARD',
] as const

export type SupportedElementType = (typeof SUPPORTED_ELEMENT_TYPES)[number]

export type ElementType = SupportedElementType | string

export type ElementData = {
  __typename?: string
  id?: string
  elementId?: number
  name: string
  type: ElementType
  content: string
  explanation?: string | null
  basePoints?: boolean
  pointsMultiplier?: number
  options?: Record<string, unknown> | null
}

export type PracticeElement = {
  id: number
  type?: string
  elementType: ElementType
  elementData: ElementData
}

export type PracticeStack = {
  id: number
  type?: string
  displayName?: string | null
  description?: string | null
  order?: number | null
  elements?: PracticeElement[] | null
}

export type PracticeQuiz = {
  id: string
  displayName: string
  name?: string
  stacks?: PracticeStack[] | null
}

export type Candidate = {
  questionRef: string
  stackTitle: string
  sourcePracticeQuizTitle: string
  courseId: string
  tags: string[]
  supportedElementTypes: SupportedElementType[]
  shortQuestionPreview: string
  relevanceScore: number
  srsScore: number
  reason: string
}

export type SafeStackRenderPayload = {
  stackId: number
  stackTitle: string
  description?: string
  elements: SafeElementInstance[]
}

export type SafeElementData = {
  __typename: string
  id: string
  elementId?: number
  name: string
  type: SupportedElementType
  content: string
  explanation?: string | null
  basePoints?: boolean
  pointsMultiplier?: number
  options?: Record<string, unknown> | null
}

export type SafeElementInstance = {
  id: number
  type: string
  elementType: SupportedElementType
  elementData: SafeElementData
}

export type QuestionRefPayload = {
  participantId: string
  chatbotId: string
  courseId: string
  stackId: number
  orderedElements: Array<{
    instanceId: number
    type: SupportedElementType
  }>
}

export type StackResponseInput = {
  instanceId: number
  type: SupportedElementType
  flashcardResponse?: 'CORRECT' | 'PARTIAL' | 'INCORRECT'
  choicesResponse?: Array<{ ix: number; selected: boolean }>
  numericalResponse?: number
  freeTextResponse?: string
}
