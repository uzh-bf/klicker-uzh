import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type {
  LiveQuizResetOutcome as LiveQuizResetOutcomeValue,
  LiveQuizResetSummary,
} from '../services/liveQuizReset.js'
import { ActivityInfoRef, type IActivityInfo } from './activities.js'
import { CourseRef } from './course.js'
import { ElementInstanceRef } from './element.js'
import { PublicationStatus } from './practiceQuiz.js'

export const LiveQuizAccessMode = builder.enumType('LiveQuizAccessMode', {
  values: Object.values(DB.AccessMode),
})

export const ElementBlockStatus = builder.enumType('ElementBlockStatus', {
  values: Object.values(DB.ElementBlockStatus),
})

export const ResetLiveQuizOutcome = builder.enumType('ResetLiveQuizOutcome', {
  values: ['SUCCESS', 'INVALID_STATE'] as const,
})

export const LiveQuizResetEligibilityReason = builder.enumType(
  'LiveQuizResetEligibilityReason',
  {
    values: ['ELIGIBLE', 'INVALID_STATE', 'ASSESSMENT_POLICY'] as const,
  }
)

export const LiveQuizResetSummaryRef = builder.objectRef<LiveQuizResetSummary>(
  'LiveQuizResetSummary'
)

export const LiveQuizResetSummaryType = LiveQuizResetSummaryRef.implement({
  fields: (t) => ({
    numOfResponses: t.exposeInt('numOfResponses'),
    numOfFeedbacks: t.exposeInt('numOfFeedbacks'),
    numOfConfusionFeedbacks: t.exposeInt('numOfConfusionFeedbacks'),
    numOfLeaderboardEntries: t.exposeInt('numOfLeaderboardEntries'),
    eligible: t.exposeBoolean('eligible'),
    reason: t.expose('reason', { type: LiveQuizResetEligibilityReason }),
  }),
})

export interface IResetLiveQuizPayload {
  outcome: LiveQuizResetOutcomeValue
  activity: IActivityInfo | null
}

export const ResetLiveQuizPayloadRef = builder.objectRef<IResetLiveQuizPayload>(
  'ResetLiveQuizPayload'
)

export const ResetLiveQuizPayload = ResetLiveQuizPayloadRef.implement({
  fields: (t) => ({
    outcome: t.expose('outcome', { type: ResetLiveQuizOutcome }),
    activity: t.expose('activity', {
      type: ActivityInfoRef,
      nullable: true,
    }),
  }),
})

// ----- AUDIENCE INTERACTION INTERFACE -----
// #region
export interface IFeedback extends DB.Feedback {
  responses?: DB.FeedbackResponse[]
}
export const FeedbackRef = builder.objectRef<IFeedback>('Feedback')
export const Feedback = FeedbackRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    isPublished: t.exposeBoolean('isPublished'),
    isPinned: t.exposeBoolean('isPinned'),
    isResolved: t.exposeBoolean('isResolved'),
    content: t.exposeString('content'),
    votes: t.exposeInt('votes'),
    responses: t.expose('responses', {
      type: [FeedbackResponseRef],
      nullable: true,
    }),
    resolvedAt: t.expose('resolvedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export const FeedbackResponseRef =
  builder.objectRef<DB.FeedbackResponse>('FeedbackResponse')
export const FeedbackResponse = FeedbackResponseRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    content: t.exposeString('content'),
    positiveReactions: t.exposeInt('positiveReactions'),
    negativeReactions: t.exposeInt('negativeReactions'),

    createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
  }),
})

export const ConfusionTimestepRef =
  builder.objectRef<DB.ConfusionTimestep>('ConfusionTimestep')
export const ConfusionTimestep = ConfusionTimestepRef.implement({
  fields: (t) => ({
    speed: t.exposeInt('speed'),
    difficulty: t.exposeInt('difficulty'),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export interface IConfusionSummary {
  speed: number
  difficulty: number
  numberOfParticipants: number
}
export const ConfusionSummary = builder
  .objectRef<IConfusionSummary>('ConfusionSummary')
  .implement({
    fields: (t) => ({
      speed: t.exposeFloat('speed'),
      difficulty: t.exposeFloat('difficulty'),
      numberOfParticipants: t.exposeInt('numberOfParticipants', {
        nullable: true,
      }),
    }),
  })
// #endregion

// ----- LIVE QUIZ INTERFACE -----
// #region
export interface ILiveQuiz extends DB.LiveQuiz {
  templateId?: string | null
  blocks?: DB.ElementBlock[] | null
  activeBlock?: DB.ElementBlock | null
  course?: DB.Course | null
  feedbacks?: DB.Feedback[] | null
  confusionFeedbacks?: DB.ConfusionTimestep[] | null
  confusionSummary?: IConfusionSummary | null
  numOfBlocks?: number
  numOfInstances?: number
  isPartOfGamifiedCourse?: boolean | null
  isPinProtected?: boolean | null
  beforeFirstBlock?: boolean
}

export const LiveQuizRef = builder.objectRef<ILiveQuiz>('LiveQuiz')
export const LiveQuiz = LiveQuizRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    namespace: t.exposeString('namespace', { nullable: true }),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    displayName: t.exposeString('displayName'),
    pinCode: t.exposeString('pinCode', { nullable: true }),
    templateId: t.exposeString('templateId', { nullable: true }),
    templateName: t.exposeString('templateName', { nullable: true }),

    isLiveQAEnabled: t.exposeBoolean('isLiveQAEnabled'),
    isConfusionFeedbackEnabled: t.exposeBoolean('isConfusionFeedbackEnabled'),
    isModerationEnabled: t.exposeBoolean('isModerationEnabled'),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),
    isAssessmentEnabled: t.exposeBoolean('isAssessmentEnabled'),
    isPartOfGamifiedCourse: t.exposeBoolean('isPartOfGamifiedCourse', {
      nullable: true,
    }),
    isPinProtected: t.exposeBoolean('isPinProtected', { nullable: true }),

    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    defaultPoints: t.exposeInt('defaultPoints'),
    defaultCorrectPoints: t.exposeInt('defaultCorrectPoints'),
    maxBonusPoints: t.exposeInt('maxBonusPoints', { nullable: true }),
    timeToZeroBonus: t.exposeInt('timeToZeroBonus', { nullable: true }),

    status: t.expose('status', { type: PublicationStatus }),
    accessMode: t.expose('accessMode', { type: LiveQuizAccessMode }),

    numOfBlocks: t.exposeInt('numOfBlocks', { nullable: true }),
    numOfInstances: t.exposeInt('numOfInstances', { nullable: true }),
    beforeFirstBlock: t.exposeBoolean('beforeFirstBlock', { nullable: true }),

    blocks: t.expose('blocks', {
      type: [ElementBlockRef],
      nullable: true,
    }),
    activeBlock: t.expose('activeBlock', {
      type: ElementBlockRef,
      nullable: true,
    }),

    feedbacks: t.expose('feedbacks', {
      type: [FeedbackRef],
      nullable: true,
    }),
    confusionFeedbacks: t.expose('confusionFeedbacks', {
      type: [ConfusionTimestepRef],
      nullable: true,
    }),
    confusionSummary: t.expose('confusionSummary', {
      type: ConfusionSummary,
      nullable: true,
    }),

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

interface ILiveQuizInfo {
  id: string
  name: string
}

export const LiveQuizInfoRef = builder.objectRef<ILiveQuizInfo>('LiveQuizInfo')
export const LiveQuizInfo = LiveQuizInfoRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
})

interface ILiveQuizMeta {
  id: string
  name: string
  status: DB.PublicationStatus
  availableFrom?: Date | null
}

export const LiveQuizMetaRef = builder.objectRef<ILiveQuizMeta>('LiveQuizMeta')
export const LiveQuizMeta = LiveQuizMetaRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    status: t.expose('status', { type: PublicationStatus }),
    availableFrom: t.expose('availableFrom', { type: 'Date', nullable: true }),
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

export interface ILiveQuizStudentSettings {
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
}
export const LiveQuizStudentSettingsRef =
  builder.objectRef<ILiveQuizStudentSettings>('LiveQuizStudentSettings')
export const LiveQuizStudentSettings = LiveQuizStudentSettingsRef.implement({
  fields: (t) => ({
    isLiveQAEnabled: t.exposeBoolean('isLiveQAEnabled'),
    isConfusionFeedbackEnabled: t.exposeBoolean('isConfusionFeedbackEnabled'),
  }),
})

export interface ILiveQuizSummary {
  numOfResponses: number
  numOfFeedbacks: number
  numOfConfusionFeedbacks: number
  numOfLeaderboardEntries: number
}
export const LiveQuizSummaryRef =
  builder.objectRef<ILiveQuizSummary>('LiveQuizSummary')
export const LiveQuizSummary = LiveQuizSummaryRef.implement({
  fields: (t) => ({
    numOfResponses: t.exposeInt('numOfResponses'),
    numOfFeedbacks: t.exposeInt('numOfFeedbacks'),
    numOfConfusionFeedbacks: t.exposeInt('numOfConfusionFeedbacks'),
    numOfLeaderboardEntries: t.exposeInt('numOfLeaderboardEntries'),
  }),
})

export interface ILiveQuizEmbeddingInfo {
  id: string
  hmac: string
  instances: { id: number; name: string }[]
}
export const LiveQuizEmbeddingInfoElementRef = builder.objectRef<
  ILiveQuizEmbeddingInfo['instances'][number]
>('LiveQuizEmbeddingInfoElement')
export const LiveQuizEmbeddingInfoElement =
  LiveQuizEmbeddingInfoElementRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
    }),
  })

export const LiveQuizEmbeddingInfoRef =
  builder.objectRef<ILiveQuizEmbeddingInfo>('LiveQuizEmbeddingInfo')
export const LiveQuizEmbeddingInfo = LiveQuizEmbeddingInfoRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    hmac: t.exposeString('hmac'),
    instances: t.expose('instances', {
      type: [LiveQuizEmbeddingInfoElementRef],
      nullable: true,
    }),
  }),
})
// #endregion
