import * as DB from '@klicker-uzh/prisma/client'
import {
  CaseStudyCaseResponse as CaseStudyCaseResponseType,
  CaseStudyCriterionResponse as CaseStudyCriterionResponseType,
  CaseStudyItemResponse as CaseStudyItemResponseType,
  ChoicesResponse as ChoicesResponseType,
  ElementBlockInput as ElementBlockInputType,
  ElementInstanceInput as ElementInstanceInputType,
  ElementStackInput as ElementStackInputType,
  FlashcardCorrectness,
  StackFeedbackStatus as StackFeedbackStatusType,
  StackResponseInput as StackResponseInputType,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { CourseRef, type ICourse } from './course.js'
import { ElementInstanceRef, InstanceEvaluation } from './element.js'
import { ElementType } from './elementData.js'
import { IStackFeedback } from './evaluation.js'

export const ElementOrderType = builder.enumType('ElementOrderType', {
  values: Object.values(DB.ElementOrderType),
})

export const PublicationStatus = builder.enumType('PublicationStatus', {
  values: Object.values(DB.PublicationStatus),
})

export const ReviewStatus = builder.enumType('ReviewStatus', {
  values: Object.values(DB.ReviewStatus),
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

export const ElementBlockInputRef =
  builder.inputRef<ElementBlockInputType>('ElementBlockInput')
export const ElementBlockInput = ElementBlockInputRef.implement({
  fields: (t) => ({
    order: t.int({ required: true }),
    timeLimit: t.int({ required: false }),
    randomSelection: t.int({ required: false }),
    elements: t.field({ type: [ElementInstanceInput], required: true }),
  }),
})

export const ElementStackInputRef =
  builder.inputRef<ElementStackInputType>('ElementStackInput')
export const ElementStackInput = ElementStackInputRef.implement({
  fields: (t) => ({
    order: t.int({ required: true }),
    displayName: t.string({ required: false }),
    description: t.string({ required: false }),
    elements: t.field({ type: [ElementInstanceInput], required: true }),
  }),
})

export const ElementInstanceInputRef =
  builder.inputRef<ElementInstanceInputType>('ElementInstanceInput')
export const ElementInstanceInput = ElementInstanceInputRef.implement({
  fields: (t) => ({
    elementId: t.int({ required: true }),
    order: t.int({ required: true }),
    existingInstanceId: t.int({ required: false }),
    duplicateInstance: t.boolean({ required: true }),
  }),
})

export const CaseStudyCriterionResponseRef =
  builder.inputRef<CaseStudyCriterionResponseType>('CaseStudyCriterionResponse')
export const CaseStudyCriterionResponse =
  CaseStudyCriterionResponseRef.implement({
    fields: (t) => ({
      criterionId: t.string({ required: true }),
      response: t.float({ required: true }),
    }),
  })

export const CaseStudyItemResponseRef =
  builder.inputRef<CaseStudyItemResponseType>('CaseStudyItemResponse')
export const CaseStudyItemResponse = CaseStudyItemResponseRef.implement({
  fields: (t) => ({
    itemId: t.int({ required: true }),
    criterionResponses: t.field({
      type: [CaseStudyCriterionResponse],
      required: true,
    }),
  }),
})

export const CaseStudyCaseResponseRef =
  builder.inputRef<CaseStudyCaseResponseType>('CaseStudyCaseResponse')
export const CaseStudyCaseResponse = CaseStudyCaseResponseRef.implement({
  fields: (t) => ({
    caseId: t.string({ required: true }),
    itemResponses: t.field({ type: [CaseStudyItemResponse], required: true }),
  }),
})

export const ChoicesResponseRef =
  builder.inputRef<ChoicesResponseType>('ChoicesResponse')
export const ChoicesResponse = ChoicesResponseRef.implement({
  fields: (t) => ({
    ix: t.int({ required: true }),
    selected: t.boolean({ required: true }),
  }),
})

export const StackResponseInputRef =
  builder.inputRef<StackResponseInputType>('StackResponseInput')
export const StackResponseInput = StackResponseInputRef.implement({
  fields: (t) => ({
    instanceId: t.int({ required: true }),
    type: t.field({ type: ElementType, required: true }),
    flashcardResponse: t.field({
      type: FlashcardCorrectnessType,
      required: false,
    }),
    contentReponse: t.boolean({ required: false }),
    choicesResponse: t.field({
      type: [ChoicesResponse],
      required: false,
    }),
    numericalResponse: t.float({ required: false }),
    freeTextResponse: t.string({ required: false }),
    selectionResponse: t.intList({ required: false }),
    caseStudyResponse: t.field({
      type: [CaseStudyCaseResponse],
      required: false,
    }),
  }),
})

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

export interface IPracticeQuiz
  extends Pick<
    DB.PracticeQuiz,
    | 'id'
    | 'name'
    | 'displayName'
    | 'description'
    | 'templateName'
    | 'pointsMultiplier'
    | 'resetTimeDays'
    | 'orderType'
    | 'status'
    | 'availableFrom'
    | 'areInstancesOutdated'
    | 'courseId'
    | 'createdAt'
    | 'updatedAt'
  > {
  course?: ICourse
  stacks?: IElementStack[]
  numOfStacks?: number
  startedCount?: number
  completedCount?: number
  repeatedCount?: number
  isOwner?: boolean
}
export const PracticeQuizRef = builder.objectRef<IPracticeQuiz>('PracticeQuiz')
export const PracticeQuiz = PracticeQuizRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    templateName: t.exposeString('templateName', { nullable: true }),

    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    resetTimeDays: t.exposeInt('resetTimeDays'),
    orderType: t.expose('orderType', { type: ElementOrderType }),
    status: t.expose('status', { type: PublicationStatus }),
    stacks: t.expose('stacks', { type: [ElementStackRef], nullable: true }),
    course: t.expose('course', { type: CourseRef, nullable: true }),
    courseId: t.exposeString('courseId', { nullable: true }),
    numOfStacks: t.exposeInt('numOfStacks', { nullable: true }),
    availableFrom: t.expose('availableFrom', { type: 'Date', nullable: true }),

    // startedCount: t.exposeInt('startedCount', { nullable: true }),
    // completedCount: t.exposeInt('completedCount', { nullable: true }),
    // repeatedCount: t.exposeInt('repeatedCount', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
  }),
})

export interface IActivitySummary {
  numOfResponses: number
  numOfAnonymousResponses: number
}
export const ActivitySummaryRef =
  builder.objectRef<IActivitySummary>('ActivitySummary')
export const ActivitySummary = ActivitySummaryRef.implement({
  fields: (t) => ({
    numOfResponses: t.exposeInt('numOfResponses'),
    numOfAnonymousResponses: t.exposeInt('numOfAnonymousResponses'),
  }),
})
