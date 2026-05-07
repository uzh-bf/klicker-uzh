import type { ElementData, StackResponseInput } from './index.js'

export const STUDENT_MCP_SUPPORTED_ELEMENT_TYPES = [
  'SC',
  'MC',
  'KPRIM',
  'NUMERICAL',
  'FREE_TEXT',
  'FLASHCARD',
] as const

export type StudentMcpSupportedElementType =
  (typeof STUDENT_MCP_SUPPORTED_ELEMENT_TYPES)[number]

export type StudentMcpElementType = ElementData['type']

export type StudentMcpElementData = Omit<Partial<ElementData>, 'options'> & {
  __typename?: string
  id?: string
  elementId?: number
  name: string
  type: StudentMcpElementType
  content: string
  options?: Record<string, unknown> | null
}

export type StudentMcpPracticeElement = {
  id: number
  type?: string
  elementType: StudentMcpElementType
  elementData: StudentMcpElementData
}

export type StudentMcpPracticeStack = {
  id: number
  type?: string
  displayName?: string | null
  description?: string | null
  order?: number | null
  elements?: StudentMcpPracticeElement[] | null
}

export type StudentMcpPracticeQuiz = {
  id: string
  displayName: string
  name?: string
  stacks?: StudentMcpPracticeStack[] | null
}

export type StudentMcpCandidate = {
  questionRef: string
  stackTitle: string
  sourcePracticeQuizTitle: string
  courseId: string
  tags: string[]
  supportedElementTypes: StudentMcpSupportedElementType[]
  shortQuestionPreview: string
  relevanceScore: number
  srsScore: number
  reason: string
}

export type StudentMcpSafeStackRenderPayload = {
  stackId: number
  stackTitle: string
  description?: string
  elements: StudentMcpSafeElementInstance[]
}

export type StudentMcpSafeElementData = {
  __typename: string
  id: string
  elementId?: number
  name: string
  type: StudentMcpSupportedElementType
  content: string
  explanation?: string | null
  basePoints?: boolean
  pointsMultiplier?: number
  options?: Record<string, unknown> | null
}

export type StudentMcpSafeElementInstance = {
  id: number
  type: string
  elementType: StudentMcpSupportedElementType
  elementData: StudentMcpSafeElementData
}

export type StudentMcpQuestionRefPayload = {
  participantId: string
  chatbotId: string
  courseId: string
  stackId: number
  orderedElements: Array<{
    instanceId: number
    type: StudentMcpSupportedElementType
  }>
}

export type StudentMcpStackResponseInput = StackResponseInput

export type StudentMcpLookupRelevantPracticeStacksInput = {
  chatbotId: string
  conversationSummary?: string
  courseId: string
  lastUserMessage: string
  limit?: number
}

export type StudentMcpLookupRelevantPracticeStacksOutput = {
  candidates: StudentMcpCandidate[]
}

export type StudentMcpGetPracticeStackForQuizInput = {
  questionRef: string
}

export type StudentMcpGetPracticeStackForQuizOutput = {
  chatbotId: string
  courseId: string
  questionRef: string
  stack: StudentMcpSafeStackRenderPayload
}

export type StudentMcpSubmitPracticeStackAnswerInput = {
  questionRef: string
  responses: StudentMcpStackResponseInput[]
  stackAnswerTimeSeconds: number
}

export type StudentMcpSubmitPracticeStackAnswerOutput = {
  chatbotId: string
  courseId: string
  result: unknown
  stackId: number
}
