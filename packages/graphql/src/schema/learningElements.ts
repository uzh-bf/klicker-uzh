import * as DB from '@klicker-uzh/prisma'

import builder from '../builder'
import type { ICourse } from './course'
import { Course } from './course'
import type { IQuestionInstance } from './question'
import { QuestionInstance } from './question'

export const LearningElementOrderType = builder.enumType(
  'LearningElementOrderType',
  {
    values: Object.values(DB.OrderType),
  }
)

export const LearningElementStatus = builder.enumType('LearningElementStatus', {
  values: Object.values(DB.LearningElementStatus),
})

export interface ILearningElement extends DB.LearningElement {
  previouslyAnswered?: number
  previousScore?: number
  previousPointsAwarded?: number
  totalTrials?: number
  instances?: IQuestionInstance[]
  numOfInstances?: number
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
    orderType: t.expose('orderType', { type: LearningElementOrderType }),
    previouslyAnswered: t.exposeInt('previouslyAnswered', { nullable: true }),
    previousScore: t.exposeFloat('previousScore', { nullable: true }),
    previousPointsAwarded: t.exposeFloat('previousPointsAwarded', {
      nullable: true,
    }),
    totalTrials: t.exposeInt('totalTrials', { nullable: true }),

    instances: t.expose('instances', {
      type: [QuestionInstance],
      nullable: true,
    }),
    numOfInstances: t.exposeInt('numOfInstances', { nullable: true }),

    course: t.expose('course', {
      type: Course,
      nullable: true,
    }),
    courseId: t.exposeString('courseId', { nullable: true }),
  }),
})
