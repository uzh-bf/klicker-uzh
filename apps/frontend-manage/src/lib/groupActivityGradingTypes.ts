import type { RouterOutputs } from './trpc'

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

export const PublicationStatus = {
  Graded: 'GRADED',
} as const

type GroupActivityGradingOutput =
  RouterOutputs['activity']['groupActivityGrading']['groupActivityGrading']

export type GroupActivityGrading = NonNullable<GroupActivityGradingOutput>

export type GroupActivityInstance = NonNullable<
  GroupActivityGrading['activityInstances']
>[number]

export type ElementInstance = NonNullable<
  NonNullable<GroupActivityGrading['stacks']>[number]['elements']
>[number]

export type ElementData = ElementInstance['elementData']

export type SelectionElementData = Extract<
  ElementData,
  { __typename: 'SelectionElementData' }
>

export type GroupActivityDecision = NonNullable<
  GroupActivityInstance['decisions']
>[number]

export type GroupActivityGradingResult = NonNullable<
  GroupActivityInstance['results']
>['grading'][number]
