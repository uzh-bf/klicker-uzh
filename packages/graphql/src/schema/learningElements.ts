import * as DB from '@klicker-uzh/prisma'

import builder from '../builder'
import type { ICourse } from './course'
import { CourseRef } from './course'
import type { IQuestionInstance } from './question'
import { QuestionInstanceRef } from './question'

export const LearningElementOrderType = builder.enumType(
  'LearningElementOrderType',
  {
    values: Object.values(DB.OrderType),
  }
)

export const LearningElementStatus = builder.enumType('LearningElementStatus', {
  values: Object.values(DB.LearningElementStatus),
})

export interface IQuestionStack extends DB.QuestionStack {
  elements?: IStackElement[]
}
export const QuestionStackRef =
  builder.objectRef<IQuestionStack>('QuestionStack')
export const QuestionStack = QuestionStackRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    displayName: t.exposeString('displayName', { nullable: true }),
    description: t.exposeString('description', { nullable: true }),
    order: t.exposeInt('order', { nullable: true }),

    elements: t.expose('elements', {
      type: [StackElement],
      nullable: true,
    }),
  }),
})

export interface IStackElement extends DB.StackElement {
  questionInstance?: IQuestionInstance
}
export const StackElementRef = builder.objectRef<IStackElement>('StackElement')
export const StackElement = StackElementRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    order: t.exposeInt('order', { nullable: true }),

    mdContent: t.exposeString('mdContent', { nullable: true }),
    questionInstance: t.expose('questionInstance', {
      type: QuestionInstanceRef,
      nullable: true,
    }),
  }),
})

export interface ILearningElement extends DB.LearningElement {
  previouslyAnswered?: number
  previousScore?: number
  previousPointsAwarded?: number
  totalTrials?: number
  stacksWithQuestions?: number
  numOfQuestions?: number
  stacks?: IQuestionStack[]
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
    stacksWithQuestions: t.exposeInt('stacksWithQuestions', {
      nullable: true,
    }),
    numOfQuestions: t.exposeInt('numOfQuestions', { nullable: true }),

    stacks: t.expose('stacks', {
      type: [QuestionStackRef],
      nullable: true,
    }),

    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),
    courseId: t.exposeString('courseId', { nullable: true }),
  }),
})
