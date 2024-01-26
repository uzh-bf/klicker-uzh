import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { Correctness } from '../types/app'
import { CourseRef, ICourse } from './course'
import { ElementInstanceRef, IElementInstance } from './question'
import { ElementType } from './questionData'

export const ElementOrderType = builder.enumType('ElementOrderType', {
  values: Object.values(DB.ElementOrderType),
})

export const PracticeQuizStatus = builder.enumType('PracticeQuizStatus', {
  values: Object.values(DB.PublicationStatus),
})

export const ElementStackType = builder.enumType('ElementStackType', {
  values: Object.values(DB.ElementStackType),
})

export const StackResponseInput = builder.inputType('StackResponseInput', {
  fields: (t) => ({
    instanceId: t.int({ required: true }),
    type: t.field({ type: ElementType, required: true }),
    flashcardResponse: t.field({
      type: Correctness,
      required: false,
    }),
    contentReponse: t.boolean({ required: false }),
    // TODO: add question response type
  }),
})

export interface IElementStack extends DB.ElementStack {
  elements?: IElementInstance[] | null
}
export const ElementStackRef = builder.objectRef<IElementStack>('ElementStack')
export const ElementStack = ElementStackRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    type: t.expose('type', { type: ElementStackType }),
    displayName: t.exposeString('displayName', { nullable: true }),
    description: t.exposeString('description', { nullable: true }),
    order: t.exposeInt('order', { nullable: true }),
    elements: t.expose('elements', {
      type: [ElementInstanceRef],
      nullable: true,
    }),
  }),
})

export interface IPracticeQuiz extends DB.PracticeQuiz {
  course?: ICourse
  stacks?: IElementStack[]
}
export const PracticeQuizRef = builder.objectRef<IPracticeQuiz>('PracticeQuiz')
export const PracticeQuiz = PracticeQuizRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    resetTimeDays: t.exposeInt('resetTimeDays'),
    orderType: t.expose('orderType', { type: ElementOrderType }),
    status: t.expose('status', { type: PracticeQuizStatus }),
    stacks: t.expose('stacks', { type: [ElementStackRef], nullable: true }),
    course: t.expose('course', { type: CourseRef, nullable: true }),
    courseId: t.exposeString('courseId', { nullable: true }),
  }),
})
