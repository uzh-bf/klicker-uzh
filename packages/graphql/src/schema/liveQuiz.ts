import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import { CourseRef } from './course.js'
import { PublicationStatus } from './practiceQuiz.js'
import { ElementInstanceRef } from './question.js'

export const LiveQuizAccessMode = builder.enumType('LiveQuizAccessMode', {
  values: Object.values(DB.AccessMode),
})

export const ElementBlockStatus = builder.enumType('ElementBlockStatus', {
  values: Object.values(DB.ElementBlockStatus),
})

interface ILiveQuiz extends DB.LiveQuiz {
  blocks: DB.ElementBlock[]
  course?: DB.Course | null
  numOfBlocks?: number
  numOfInstances?: number
}

export const LiveQuizRef = builder.objectRef<ILiveQuiz>('LiveQuiz')
export const LiveQuiz = LiveQuizRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    namespace: t.exposeString('namespace'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    displayName: t.exposeString('displayName'),
    pinCode: t.exposeInt('pinCode', { nullable: true }),

    isLiveQAEnabled: t.exposeBoolean('isLiveQAEnabled'),
    isConfusionFeedbackEnabled: t.exposeBoolean('isConfusionFeedbackEnabled'),
    isModerationEnabled: t.exposeBoolean('isModerationEnabled'),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),

    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    maxBonusPoints: t.exposeInt('maxBonusPoints'),
    timeToZeroBonus: t.exposeInt('timeToZeroBonus'),

    status: t.expose('status', { type: PublicationStatus }),
    accessMode: t.expose('accessMode', { type: LiveQuizAccessMode }),

    numOfBlocks: t.exposeInt('numOfBlocks', { nullable: true }),
    numOfInstances: t.exposeInt('numOfInstances', { nullable: true }),

    blocks: t.expose('blocks', {
      type: [ElementBlockRef],
      nullable: true,
    }),
    // activeBlock: t.expose('activeBlock', {
    //   type: ElementBlockRef,
    //   nullable: true,
    // }),

    // feedbacks: t.expose('feedbacks', {
    //   type: [FeedbackRef],
    //   nullable: true,
    // }),
    // confusionFeedbacks: t.expose('confusionFeedbacks', {
    //   type: [ConfusionTimestepRef],
    //   nullable: true,
    // }),
    // confusionSummary: t.expose('confusionSummary', {
    //   type: ConfusionSummary,
    //   nullable: true,
    // }),
    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),

    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
  }),
})

export interface IElementBlock extends DB.ElementBlock {
  numOfParticipants?: number
  elements?: DB.ElementInstance[] | null
}
export const ElementBlockRef = builder.objectRef<IElementBlock>('ElementBlock')
export const ElementBlock = ElementBlockRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    numOfParticipants: t.exposeInt('numOfParticipants', { nullable: true }),
    status: t.expose('status', { type: ElementBlockStatus }),
    order: t.exposeInt('order'),
    expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true }),
    timeLimit: t.exposeInt('timeLimit', { nullable: true }),
    randomSelection: t.exposeInt('randomSelection', { nullable: true }),
    execution: t.exposeInt('execution', { nullable: true }),

    elements: t.expose('elements', {
      type: [ElementInstanceRef],
      nullable: true,
    }),
  }),
})
