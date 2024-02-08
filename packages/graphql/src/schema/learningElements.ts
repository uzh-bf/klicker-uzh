import * as DB from '@klicker-uzh/prisma'

import builder from '../builder'
import type { ICourse } from './course'
import { CourseRef } from './course'

export const PracticeQuizOrderType = builder.enumType('PracticeQuizOrderType', {
  values: Object.values(DB.OrderType),
})

export const LearningElementStatus = builder.enumType('LearningElementStatus', {
  values: Object.values(DB.LearningElementStatus),
})

export interface ILearningElement extends DB.LearningElement {
  previouslyAnswered?: number
  previousScore?: number
  previousPointsAwarded?: number
  totalTrials?: number
  stacksWithQuestions?: number
  numOfQuestions?: number
  course?: ICourse | null
}
export const LearningElementRef =
  builder.objectRef<ILearningElement>('LearningElement')
export const LearningElement = LearningElementRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    status: t.expose('status', { type: LearningElementStatus }),
    description: t.exposeString('description', { nullable: true }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    resetTimeDays: t.exposeInt('resetTimeDays', { nullable: true }),
    orderType: t.expose('orderType', { type: PracticeQuizOrderType }),
    previouslyAnswered: t.exposeInt('previouslyAnswered', { nullable: true }),
    previousScore: t.exposeFloat('previousScore', { nullable: true }),
    previousPointsAwarded: t.exposeFloat('previousPointsAwarded', {
      nullable: true,
    }),
    totalTrials: t.exposeInt('totalTrials', { nullable: true }),
    stacksWithQuestions: t.exposeInt('stacksWithQuestions', {
      nullable: true,
    }),
    numOfQuestions: t.exposeInt('numOfQuestions', { nullable: true }),

    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),
    courseId: t.exposeString('courseId', { nullable: true }),
  }),
})
