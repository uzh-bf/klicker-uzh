import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityStudentPerformance as ActivityStudentPerformanceType,
  AssessmentResultsCourse as AssessmentResultsCourseType,
  AssessmentResultsLiveQuiz as AssessmentResultsLiveQuizType,
  StudentAssessmentBlockResponse as StudentAssessmentBlockResponseType,
  StudentAssessmentInstanceResponse as StudentAssessmentInstanceResponseType,
  StudentAssessmentResultsItem as StudentAssessmentResultsItemType,
  StudentPointCorrection as StudentPointCorrectionType,
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
      activityId: t.exposeString('activityId'),
      displayName: t.exposeString('displayName'),
      finishedAt: t.expose('finishedAt', { type: 'Date' }),
      multiplier: t.exposeInt('multiplier'),
      basePoints: t.exposeFloat('basePoints'),
      availableBasePoints: t.exposeFloat('availableBasePoints'),
      correctnessPoints: t.exposeFloat('correctnessPoints'),
      availableCorrectnessPoints: t.exposeFloat('availableCorrectnessPoints'),
      bonusPoints: t.exposeFloat('bonusPoints'),
      availableBonusPoints: t.exposeFloat('availableBonusPoints'),
      corrections: t.expose('corrections', {
        type: [StudentPointCorrectionRef],
      }),
    }),
  })

export const StudentPointCorrectionRef =
  builder.objectRef<StudentPointCorrectionType>('StudentPointCorrection')
export const StudentPointCorrection = StudentPointCorrectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    lecturerReason: t.exposeString('lecturerReason', { nullable: true }),
    studentReason: t.exposeString('studentReason'),
    awardedBasePoints: t.exposeFloat('awardedBasePoints'),
    awardedCorrectnessPoints: t.exposeFloat('awardedCorrectnessPoints'),
    awardedBonusPoints: t.exposeFloat('awardedBonusPoints'),
    deductedBasePoints: t.exposeFloat('deductedBasePoints'),
    deductedCorrectnessPoints: t.exposeFloat('deductedCorrectnessPoints'),
    deductedBonusPoints: t.exposeFloat('deductedBonusPoints'),
  }),
})

export const StudentAssessmentResultsItemRef =
  builder.objectRef<StudentAssessmentResultsItemType>(
    'StudentAssessmentResultsItem'
  )
export const StudentAssessmentResultsItem =
  StudentAssessmentResultsItemRef.implement({
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
      numberOfCorrections: t.exposeInt('numberOfCorrections'),
      studentResults: t.expose('studentResults', {
        type: [StudentAssessmentResultsItemRef],
      }),
    }),
  }
)

export const AssessmentResultsCourseRef =
  builder.objectRef<AssessmentResultsCourseType>('AssessmentResultsCourse')
export const AssessmentResultsCourse = AssessmentResultsCourseRef.implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    availableBasePoints: t.exposeFloat('availableBasePoints'),
    availableCorrectnessPoints: t.exposeFloat('availableCorrectnessPoints'),
    availableBonusPoints: t.exposeFloat('availableBonusPoints'),
    numberOfCorrections: t.exposeInt('numberOfCorrections'),
    studentResults: t.expose('studentResults', {
      type: [StudentAssessmentResultsItemRef],
    }),
  }),
})

export const StudentAssessmentInstanceResponseRef =
  builder.objectRef<StudentAssessmentInstanceResponseType>(
    'StudentAssessmentInstanceResponse'
  )
export const StudentAssessmentInstanceResponse =
  StudentAssessmentInstanceResponseRef.implement({
    fields: (t) => ({
      instance: t.expose('instance', { type: ElementInstance }),
      corrections: t.expose('corrections', { type: [AppliedPointCorrection] }),
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
    participants?: DB.Participant[] | null
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
    participants: t.expose('participants', {
      type: [ParticipantRef],
      nullable: true,
    }),
    liveQuiz: t.expose('liveQuiz', { type: LiveQuizRef, nullable: true }),
    instance: t.expose('instance', {
      type: ElementInstanceRef,
      nullable: true,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export const AppliedPointCorrection = builder.objectRef<
  DB.AppliedPointCorrection & { pointCorrection: DB.PointCorrection }
>('AppliedPointCorrection')
export const AppliedPointCorrectionType = AppliedPointCorrection.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    awardedBasePoints: t.exposeFloat('awardedBasePoints'),
    awardedCorrectnessPoints: t.exposeFloat('awardedCorrectnessPoints'),
    awardedBonusPoints: t.exposeFloat('awardedBonusPoints'),
    deductedBasePoints: t.exposeFloat('deductedBasePoints'),
    deductedCorrectnessPoints: t.exposeFloat('deductedCorrectnessPoints'),
    deductedBonusPoints: t.exposeFloat('deductedBonusPoints'),
    pointCorrection: t.expose('pointCorrection', { type: PointCorrectionRef }),
  }),
})
