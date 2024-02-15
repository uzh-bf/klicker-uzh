import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import {
  FlashcardCorrectness,
  StackFeedbackStatus as StackFeedbackStatusType,
} from '../types/app'
import { CourseRef, ICourse } from './course'
import {
  ElementInstanceRef,
  IInstanceEvaluation,
  InstanceEvaluation,
} from './question'
import { ElementType } from './questionData'

export const ElementOrderType = builder.enumType('ElementOrderType', {
  values: Object.values(DB.ElementOrderType),
})

export const PublicationStatus = builder.enumType('PublicationStatus', {
  values: Object.values(DB.PublicationStatus),
})

export const ElementStackType = builder.enumType('ElementStackType', {
  values: Object.values(DB.ElementStackType),
})

export const FlashcardCorrectnessType = builder.enumType(
  'FlashcardCorrectnessType',
  {
    values: Object.values(FlashcardCorrectness),
  }
)

export const StackFeedbackStatus = builder.enumType('StackFeedbackStatus', {
  values: Object.values(StackFeedbackStatusType),
})

export const ElementStackInput = builder.inputType('ElementStackInput', {
  fields: (t) => ({
    order: t.int({ required: true }),
    displayName: t.string({ required: false }),
    description: t.string({ required: false }),
    elements: t.field({ type: [StackElementsInput], required: true }),
  }),
})

export const StackElementsInput = builder.inputType('StackElementsInput', {
  fields: (t) => ({
    elementId: t.int({ required: true }),
    order: t.int({ required: true }),
  }),
})

export const StackResponseInput = builder.inputType('StackResponseInput', {
  fields: (t) => ({
    instanceId: t.int({ required: true }),
    type: t.field({ type: ElementType, required: true }),
    flashcardResponse: t.field({
      type: FlashcardCorrectnessType,
      required: false,
    }),
    contentReponse: t.boolean({ required: false }),
    choicesResponse: t.intList({ required: false }),
    numericalResponse: t.float({ required: false }),
    freeTextResponse: t.string({ required: false }),
  }),
})

export interface IStackFeedback {
  id: number
  status: StackFeedbackStatusType
  score?: number
  evaluations?: IInstanceEvaluation[]
}
export const StackFeedback = builder
  .objectRef<IStackFeedback>('StackFeedback')
  .implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      status: t.expose('status', { type: StackFeedbackStatus }),
      score: t.exposeInt('score', { nullable: true }),
      evaluations: t.expose('evaluations', {
        type: [InstanceEvaluation],
        nullable: true,
      }),
    }),
  })

export interface IElementStack extends DB.ElementStack {
  elements?: DB.ElementInstance[] | null
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
  numOfQuestions?: number
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
    status: t.expose('status', { type: PublicationStatus }),
    stacks: t.expose('stacks', { type: [ElementStackRef], nullable: true }),
    course: t.expose('course', { type: CourseRef, nullable: true }),
    courseId: t.exposeString('courseId', { nullable: true }),
    numOfQuestions: t.exposeInt('numOfQuestions', { nullable: true }),
  }),
})
