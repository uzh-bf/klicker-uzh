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

export const PointCorrectionType = {
  AllCourse: 'ALL_COURSE',
  Multiple: 'MULTIPLE',
  Participating: 'PARTICIPATING',
  Single: 'SINGLE',
} as const

export type PointCorrectionType =
  (typeof PointCorrectionType)[keyof typeof PointCorrectionType]

export const ResponseCorrectness = {
  Correct: 'CORRECT',
  Partial: 'PARTIAL',
  Wrong: 'WRONG',
} as const

export type ResponseCorrectness =
  (typeof ResponseCorrectness)[keyof typeof ResponseCorrectness]

type AssessmentResultsLiveQuiz = NonNullable<
  RouterOutputs['activity']['assessmentResultsLiveQuiz']['assessmentResultsLiveQuiz']
>

export type AssessmentStudentResult =
  AssessmentResultsLiveQuiz['studentResults'][number]

export type StudentCourseResult =
  RouterOutputs['activity']['studentCourseResults']['studentCourseResults'][number]

export type LiveQuizStudentAssessmentResponses = NonNullable<
  RouterOutputs['activity']['liveQuizStudentAssessmentResponses']['liveQuizStudentAssessmentResponses']
>

export type LiveQuizStudentAssessmentInstance =
  LiveQuizStudentAssessmentResponses[number]['instances'][number]['instance']

export type PreviousPointCorrection =
  RouterOutputs['activity']['previousPointCorrections']['previousPointCorrections'][number]
