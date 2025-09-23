import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityStudentPerformance as ActivityStudentPerformanceType,
  AssessmentResultsLiveQuiz as AssessmentResultsLiveQuizType,
  StudentAssessmentBlockResponse as StudentAssessmentBlockResponseType,
  StudentAssessmentInstanceResponse as StudentAssessmentInstanceResponseType,
  StudentAssessmentQuizResults as StudentAssessmentQuizResultsType,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { ElementInstance, ElementInstanceRef } from './element.js'
import { ResponseCorrectness } from './evaluation.js'
import { LiveQuizRef } from './liveQuiz.js'
import { ParticipantRef } from './participant.js'
import { UserRef } from './user.js'

export const PointCorrectionType = builder.enumType('PointCorrectionType', {
  values: Object.values(DB.PointCorrectionType),
})

export interface IStudentAssessmentResults {
  liveQuizzes: ActivityStudentPerformanceType[]
  practiceQuizzes: ActivityStudentPerformanceType[]
  microLearnings: ActivityStudentPerformanceType[]
  groupActivities: ActivityStudentPerformanceType[]
}
export const StudentAssessmentResultsRef =
  builder.objectRef<IStudentAssessmentResults>('StudentAssessmentResults')
export const StudentAssessmentResults = StudentAssessmentResultsRef.implement({
  fields: (t) => ({
    liveQuizzes: t.expose('liveQuizzes', {
      type: [ActivityStudentPerformanceRef],
    }),
    practiceQuizzes: t.expose('practiceQuizzes', {
      type: [ActivityStudentPerformanceRef],
    }),
    microLearnings: t.expose('microLearnings', {
      type: [ActivityStudentPerformanceRef],
    }),
    groupActivities: t.expose('groupActivities', {
      type: [ActivityStudentPerformanceRef],
    }),
  }),
})

export const ActivityStudentPerformanceRef =
  builder.objectRef<ActivityStudentPerformanceType>(
    'ActivityStudentPerformance'
  )
export const ActivityStudentPerformance =
  ActivityStudentPerformanceRef.implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      displayName: t.exposeString('displayName'),
      finishedAt: t.expose('finishedAt', { type: 'Date' }),
      multiplier: t.exposeInt('multiplier'),
      basePoints: t.exposeFloat('basePoints'),
      availableBasePoints: t.exposeFloat('availableBasePoints'),
      correctnessPoints: t.exposeFloat('correctnessPoints'),
      availableCorrectnessPoints: t.exposeFloat('availableCorrectnessPoints'),
      bonusPoints: t.exposeFloat('bonusPoints'),
      availableBonusPoints: t.exposeFloat('availableBonusPoints'),
    }),
  })

export const StudentAssessmentQuizResultsRef =
  builder.objectRef<StudentAssessmentQuizResultsType>(
    'StudentAssessmentQuizResults'
  )
export const StudentAssessmentQuizResults =
  StudentAssessmentQuizResultsRef.implement({
    fields: (t) => ({
      participantId: t.exposeString('participantId'),
      participantEmail: t.exposeString('participantEmail'),
      basePoints: t.exposeFloat('basePoints'),
      correctnessPoints: t.exposeFloat('correctnessPoints'),
      bonusPoints: t.exposeFloat('bonusPoints'),
    }),
  })

export const AssessmentResultsLiveQuizRef =
  builder.objectRef<AssessmentResultsLiveQuizType>('AssessmentResultsLiveQuiz')
export const AssessmentResultsLiveQuiz = AssessmentResultsLiveQuizRef.implement(
  {
    fields: (t) => ({
      name: t.exposeString('name'),
      quizBasePoints: t.exposeFloat('quizBasePoints'),
      quizCorrectnessPoints: t.exposeFloat('quizCorrectnessPoints'),
      quizBonusPoints: t.exposeFloat('quizBonusPoints'),
      availableBasePoints: t.exposeFloat('availableBasePoints'),
      availableCorrectnessPoints: t.exposeFloat('availableCorrectnessPoints'),
      availableBonusPoints: t.exposeFloat('availableBonusPoints'),
      studentResults: t.expose('studentResults', {
        type: [StudentAssessmentQuizResultsRef],
      }),
    }),
  }
)

export const StudentAssessmentInstanceResponseRef =
  builder.objectRef<StudentAssessmentInstanceResponseType>(
    'StudentAssessmentInstanceResponse'
  )
export const StudentAssessmentInstanceResponse =
  StudentAssessmentInstanceResponseRef.implement({
    fields: (t) => ({
      instance: t.expose('instance', { type: ElementInstance }),
      basePoints: t.exposeFloat('basePoints'),
      correctnessPoints: t.exposeFloat('correctnessPoints'),
      bonusPoints: t.exposeFloat('bonusPoints'),
      correctness: t.expose('correctness', {
        type: ResponseCorrectness,
        nullable: true,
      }),
      submission: t.expose('submission', { type: 'Json', nullable: true }),
    }),
  })

export const StudentAssessmentBlockResponseRef =
  builder.objectRef<StudentAssessmentBlockResponseType>(
    'StudentAssessmentBlockResponse'
  )
export const StudentAssessmentBlockResponse =
  StudentAssessmentBlockResponseRef.implement({
    fields: (t) => ({
      blockId: t.exposeInt('blockId'),
      instances: t.expose('instances', {
        type: [StudentAssessmentInstanceResponseRef],
      }),
    }),
  })

export const PointCorrectionRef = builder.objectRef<
  DB.PointCorrection & {
    correctedBy?: DB.User | null
    participant?: DB.Participant | null
    liveQuiz?: DB.LiveQuiz | null
    instance?: DB.ElementInstance | null
  }
>('PointCorrection')
export const PointCorrection = PointCorrectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    basePoints: t.exposeBoolean('basePoints', { nullable: true }),
    correctnessPoints: t.exposeBoolean('correctnessPoints', { nullable: true }),
    bonusPoints: t.exposeBoolean('bonusPoints', { nullable: true }),
    reason: t.exposeString('reason'),
    studentReason: t.exposeString('studentReason'),
    type: t.expose('type', { type: PointCorrectionType }),
    participantId: t.exposeString('participantId', { nullable: true }),
    correctedBy: t.expose('correctedBy', { type: UserRef, nullable: true }),
    participant: t.expose('participant', {
      type: ParticipantRef,
      nullable: true,
    }),
    liveQuiz: t.expose('liveQuiz', { type: LiveQuizRef, nullable: true }),
    instance: t.expose('instance', {
      type: ElementInstanceRef,
      nullable: true,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})
