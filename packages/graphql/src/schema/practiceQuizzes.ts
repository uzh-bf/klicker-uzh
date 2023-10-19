import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { CourseRef, ICourse } from './course'
import { ElementData, ElementType } from './questionData'

export const PracticeQuizOrderType = builder.enumType('PracticeQuizOrderType', {
  values: Object.values(DB.ElementOrderType),
})

export const PracticeQuizStatus = builder.enumType('PracticeQuizStatus', {
  values: Object.values(DB.PublicationStatus),
})

export const ElementInstaceType = builder.enumType('ElementInstaceType', {
  values: Object.values(DB.ElementInstanceType),
})

export const ElementStackType = builder.enumType('ElementStackType', {
  values: Object.values(DB.ElementStackType),
})

export interface IElementInstance extends DB.ElementInstance {}

export const ElementInstanceRef =
  builder.objectRef<IElementInstance>('ElementInstance')
export const ElementInstance = ElementInstanceRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    type: t.expose('type', { type: ElementStackType }),
    elementType: t.expose('elementType', { type: ElementType }),

    elementData: t.field({
      type: ElementData,
      resolve: (q) => q.elementData,
    }),
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
    orderType: t.expose('orderType', { type: PracticeQuizOrderType }),
    status: t.expose('status', { type: PracticeQuizStatus }),
    stacks: t.expose('stacks', { type: [ElementStackRef], nullable: true }),
    course: t.expose('course', { type: CourseRef, nullable: true }),
    courseId: t.exposeString('courseId', { nullable: true }),
  }),
})
