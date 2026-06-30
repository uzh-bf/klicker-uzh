import type { RouterOutputs } from './trpc'

type PracticeQuizEvaluation = NonNullable<
  RouterOutputs['analytics']['practiceQuizEvaluation']['practiceQuizEvaluation']
>
type MicroLearningEvaluation = NonNullable<
  RouterOutputs['analytics']['microLearningEvaluation']['microLearningEvaluation']
>
type LiveQuizEvaluation = NonNullable<
  RouterOutputs['analytics']['liveQuizEvaluation']['liveQuizEvaluation']
>

export type ActivityEvaluationData =
  | PracticeQuizEvaluation
  | MicroLearningEvaluation
  | LiveQuizEvaluation
export type StackEvaluation = ActivityEvaluationData['results'][number]
export type ElementInstanceEvaluation = StackEvaluation['instances'][number]

export type ChoicesActivityEvaluationData = Extract<
  ElementInstanceEvaluation,
  { __typename: 'ChoicesActivityEvaluationData' }
>
export type NumericalActivityEvaluationData = Extract<
  ElementInstanceEvaluation,
  { __typename: 'NumericalActivityEvaluationData' }
>
export type FreeTextActivityEvaluationData = Extract<
  ElementInstanceEvaluation,
  { __typename: 'FreeTextActivityEvaluationData' }
>
export type SelectionActivityEvaluationData = Extract<
  ElementInstanceEvaluation,
  { __typename: 'SelectionActivityEvaluationData' }
>
export type CaseStudyActivityEvaluationData = Extract<
  ElementInstanceEvaluation,
  { __typename: 'CaseStudyActivityEvaluationData' }
>
export type FlashcardActivityEvaluationData = Extract<
  ElementInstanceEvaluation,
  { __typename: 'FlashcardActivityEvaluationData' }
>
export type ContentActivityEvaluationData = Extract<
  ElementInstanceEvaluation,
  { __typename: 'ContentActivityEvaluationData' }
>

export type CaseStudyElementResults = CaseStudyActivityEvaluationData['results']
export type CaseStudyElementResultCaseInfo =
  CaseStudyActivityEvaluationData['cases'][number]
export type CaseStudyElementResultItemInfo =
  CaseStudyActivityEvaluationData['items'][number]
export type CaseStudyElementResultCriterionInfo =
  CaseStudyActivityEvaluationData['criteria'][number]
export type CaseStudyElementResultCriterion =
  CaseStudyElementResults['caseResults'][number]['items'][number]['criteria'][number]

export type Feedback = NonNullable<LiveQuizEvaluation['feedbacks']>[number]
export type ConfusionTimestep = NonNullable<
  LiveQuizEvaluation['confusionFeedbacks']
>[number]
export const LocaleType = {
  De: 'de',
  En: 'en',
} as const
export type LocaleType = (typeof LocaleType)[keyof typeof LocaleType]

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

export const ElementBlockStatus = {
  Active: 'ACTIVE',
  Executed: 'EXECUTED',
  Scheduled: 'SCHEDULED',
} as const
export type ElementBlockStatus =
  (typeof ElementBlockStatus)[keyof typeof ElementBlockStatus]
