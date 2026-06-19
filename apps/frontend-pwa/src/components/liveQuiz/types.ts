import type { RouterOutputs } from '@lib/trpc'

export type StudentLiveQuizData = NonNullable<
  RouterOutputs['participant']['runningLiveQuiz']['studentLiveQuiz']
>

export type LiveQuizBlock = StudentLiveQuizData['blocks'][number]
export type LiveQuizElementInstance = LiveQuizBlock['elements'][number]

export type ElementBlockStatus = LiveQuizBlock['status']
export const ElementBlockStatus = {
  Active: 'ACTIVE',
  Executed: 'EXECUTED',
  Scheduled: 'SCHEDULED',
} as const satisfies Record<string, ElementBlockStatus>

export type ElementType = LiveQuizElementInstance['elementType']
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
} as const satisfies Record<string, ElementType>
