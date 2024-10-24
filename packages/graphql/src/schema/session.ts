import * as DB from '@klicker-uzh/prisma'
import type {
  ContentResults as ContentResultsType,
  ElementResultsChoices as ElementResultsChoicesType,
  ElementResultsOpen as ElementResultsOpenType,
  FlashcardResults as FlashcardResultsType,
  QuestionResults,
  SingleQuestionResponseChoices as SingleQuestionResponseChoicesType,
  SingleQuestionResponseContent as SingleQuestionResponseContentType,
  SingleQuestionResponseFlashcard as SingleQuestionResponseFlashcardType,
  SingleQuestionResponseValue as SingleQuestionResponseValueType,
} from '@klicker-uzh/types'
import { FlashcardCorrectness as FlashcardCorrectnessEnum } from '@klicker-uzh/types'
import builder from '../builder.js'
import { CourseRef, type ICourse } from './course.js'
import { FlashcardCorrectness } from './evaluation.js'
import { QuestionInstanceRef } from './question.js'
import { ElementType, QuestionData } from './questionData.js'

export const SessionStatus = builder.enumType('SessionStatus', {
  values: Object.values(DB.SessionStatus),
})

export const SessionBlockStatus = builder.enumType('SessionBlockStatus', {
  values: Object.values(DB.SessionBlockStatus),
})

export const SessionAccessMode = builder.enumType('SessionAccessMode', {
  values: Object.values(DB.AccessMode),
})

export const ResponseCorrectness = builder.enumType('ResponseCorrectness', {
  values: Object.values(DB.ResponseCorrectness),
})

export const BlockInput = builder.inputType('BlockInput', {
  fields: (t) => ({
    questionIds: t.intList({ required: true }),
    randomSelection: t.int({ required: false }),
    timeLimit: t.int({ required: false }),
  }),
})

// ----- LIVE QUIZ INTERFACE -----
// #region
export interface ISession extends DB.LiveSession {
  numOfBlocks?: number
  numOfQuestions?: number
  activeBlock?: ISessionBlock | null
  blocks?: ISessionBlock[]
  feedbacks?: IFeedback[]
  confusionFeedbacks?: DB.ConfusionTimestep[]
  confusionSummary?: IConfusionSummary
  course?: ICourse | null
}
export const SessionRef = builder.objectRef<ISession>('Session')
export const Session = SessionRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    isLiveQAEnabled: t.exposeBoolean('isLiveQAEnabled'),
    isConfusionFeedbackEnabled: t.exposeBoolean('isConfusionFeedbackEnabled'),
    isModerationEnabled: t.exposeBoolean('isModerationEnabled'),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),

    namespace: t.exposeString('namespace'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    displayName: t.exposeString('displayName'),
    linkToJoin: t.exposeString('linkTo', { nullable: true }),
    pinCode: t.exposeInt('pinCode', { nullable: true }),

    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    maxBonusPoints: t.exposeInt('maxBonusPoints'),
    timeToZeroBonus: t.exposeInt('timeToZeroBonus'),

    status: t.expose('status', { type: SessionStatus }),
    accessMode: t.expose('accessMode', { type: SessionAccessMode }),

    numOfBlocks: t.exposeInt('numOfBlocks', { nullable: true }),
    numOfQuestions: t.exposeInt('numOfQuestions', { nullable: true }),

    activeBlock: t.expose('activeBlock', {
      type: SessionBlockRef,
      nullable: true,
    }),
    blocks: t.expose('blocks', {
      type: [SessionBlockRef],
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

    linkTo: t.exposeString('linkTo', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
  }),
})

export interface ISessionBlock extends DB.SessionBlock {
  numOfParticipants?: number
  instances?: DB.QuestionInstance[]
}
export const SessionBlockRef = builder.objectRef<ISessionBlock>('SessionBlock')
export const SessionBlock = SessionBlockRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    numOfParticipants: t.exposeInt('numOfParticipants', { nullable: true }),

    status: t.expose('status', { type: SessionBlockStatus }),
    order: t.exposeInt('order'),
    expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true }),
    timeLimit: t.exposeInt('timeLimit', { nullable: true }),
    randomSelection: t.exposeInt('randomSelection', { nullable: true }),
    execution: t.exposeInt('execution', { nullable: true }),

    instances: t.expose('instances', {
      type: [QuestionInstanceRef],
      nullable: true,
    }),
  }),
})

export interface IRunningLiveQuizSummary {
  numOfResponses: number
  numOfFeedbacks: number
  numOfConfusionFeedbacks: number
  numOfLeaderboardEntries: number
}
export const RunningLiveQuizSummaryRef =
  builder.objectRef<IRunningLiveQuizSummary>('RunningLiveQuizSummary')
export const RunningLiveQuizSummary = RunningLiveQuizSummaryRef.implement({
  fields: (t) => ({
    numOfResponses: t.exposeInt('numOfResponses'),
    numOfFeedbacks: t.exposeInt('numOfFeedbacks'),
    numOfConfusionFeedbacks: t.exposeInt('numOfConfusionFeedbacks'),
    numOfLeaderboardEntries: t.exposeInt('numOfLeaderboardEntries'),
  }),
})
// #endregion

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

// ----- LIVE QUIZ EVALUATION INTERFACE -----
export interface IStatistics {
  max: number
  min: number
  mean: number
  median: number
  q1: number
  q3: number
  sd: number
}
export const Statistics = builder
  .objectRef<IStatistics>('Statistics')
  .implement({
    fields: (t) => ({
      max: t.exposeFloat('max'),
      min: t.exposeFloat('min'),
      mean: t.exposeFloat('mean'),
      median: t.exposeFloat('median'),
      q1: t.exposeFloat('q1'),
      q3: t.exposeFloat('q3'),
      sd: t.exposeFloat('sd'),
    }),
  })

// ----- INSTANCE RESULT INTERFACE -----
export interface IInstanceResult {
  id: string
  blockIx?: number
  instanceIx: number
  participants: number
  results: QuestionResults
  status: DB.SessionBlockStatus
  questionData: DB.QuestionInstance['questionData']
  statistics?: IStatistics
}
export const InstanceResultRef =
  builder.objectRef<IInstanceResult>('InstanceResult')
export const InstanceResult = InstanceResultRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),

    blockIx: t.exposeInt('blockIx', { nullable: true }),
    instanceIx: t.exposeInt('instanceIx'),
    participants: t.exposeInt('participants'),

    // TODO: replace entire instance results type with union type and this with aggregated responses types defined below after migration of live quiz to element stacks
    results: t.expose('results', { type: 'Json' }),
    status: t.expose('status', { type: SessionBlockStatus }),

    questionData: t.field({
      type: QuestionData,
      resolve: (q) => q.questionData,
    }),
    statistics: t.expose('statistics', { type: Statistics, nullable: true }),
  }),
})
// #endregion

// ----- SINGLE QUESTION RESPONSE INTERFACES -----
// #region
export const SingleQuestionResponseChoices = builder
  .objectRef<SingleQuestionResponseChoicesType>('SingleQuestionResponseChoices')
  .implement({
    fields: (t) => ({
      choices: t.exposeIntList('choices'),
    }),
  })

export const SingleQuestionResponseValue = builder
  .objectRef<SingleQuestionResponseValueType>('SingleQuestionResponseValue')
  .implement({
    fields: (t) => ({
      value: t.exposeString('value'),
    }),
  })

export const SingleQuestionResponseFlashcard = builder
  .objectRef<SingleQuestionResponseFlashcardType>(
    'SingleQuestionResponseFlashcard'
  )
  .implement({
    fields: (t) => ({
      correctness: t.expose('correctness', { type: FlashcardCorrectness }),
    }),
  })

export const SingleQuestionResponseContent = builder
  .objectRef<SingleQuestionResponseContentType>('SingleQuestionResponseContent')
  .implement({
    fields: (t) => ({
      viewed: t.exposeBoolean('viewed'),
    }),
  })
// #endregion

// ----- AGGREGATED RESPONSES / RESULTS INTERFACES -----
// #region
export const ElementResultsChoicesRef =
  builder.objectRef<ElementResultsChoicesType>('ElementResultsChoices')
export const ElementResultsChoices = ElementResultsChoicesRef.implement({
  fields: (t) => ({
    // ? differing number of keys - no graphql representation available
    choices: t.expose('choices', { type: 'Json' }),
    total: t.exposeInt('total'),
  }),
})

export const ElementResultsOpenRef =
  builder.objectRef<ElementResultsOpenType>('ElementResultsOpen')
export const ElementResultsOpen = ElementResultsOpenRef.implement({
  fields: (t) => ({
    // ? differing number of keys - no graphql representation available
    responses: t.expose('responses', { type: 'Json' }),
    total: t.exposeInt('total'),
  }),
})

export const ElementResultsFlashcardRef =
  builder.objectRef<FlashcardResultsType>('ElementResultsFlashcard')
export const ElementResultsFlashcard = ElementResultsFlashcardRef.implement({
  fields: (t) => ({
    CORRECT: t.exposeInt(FlashcardCorrectnessEnum.CORRECT),
    PARTIAL: t.exposeInt(FlashcardCorrectnessEnum.PARTIAL),
    INCORRECT: t.exposeInt(FlashcardCorrectnessEnum.INCORRECT),
    total: t.exposeInt('total'),
  }),
})

export const ElementResultsContentRef = builder.objectRef<ContentResultsType>(
  'ElementResultsContent'
)
export const ElementResultsContent = ElementResultsContentRef.implement({
  fields: (t) => ({
    total: t.exposeInt('total'),
  }),
})
// #endregion

// ----- QUESTION RESPONSE INTERFACES -----
// #region
const sharedQuestionResponseProps = (t: any) => ({
  id: t.exposeInt('id'),
  elementType: t.expose('elementType', { type: ElementType }),

  trialsCount: t.exposeInt('trialsCount'),
  totalScore: t.exposeFloat('totalScore'),
  totalPointsAwarded: t.exposeFloat('totalPointsAwarded', { nullable: true }),
  totalXpAwarded: t.exposeFloat('totalXpAwarded', { nullable: true }),

  lastAwardedAt: t.expose('lastAwardedAt', { type: 'Date', nullable: true }),
  lastXpAwardedAt: t.expose('lastXpAwardedAt', {
    type: 'Date',
    nullable: true,
  }),
  lastAnsweredAt: t.expose('lastAnsweredAt', {
    type: 'Date',
    nullable: true,
  }),

  correctCount: t.exposeInt('correctCount'),
  correctCountStreak: t.exposeInt('correctCountStreak'),
  lastCorrectAt: t.expose('lastCorrectAt', { type: 'Date', nullable: true }),
  partialCorrectCount: t.exposeInt('partialCorrectCount'),
  lastPartialCorrectAt: t.expose('lastPartialCorrectAt', {
    type: 'Date',
    nullable: true,
  }),

  eFactor: t.exposeFloat('eFactor'),
  interval: t.exposeInt('interval'),
  nextDueAt: t.expose('nextDueAt', { type: 'Date', nullable: true }),
  wrongCount: t.exposeInt('wrongCount'),
  lastWrongAt: t.expose('lastWrongAt', { type: 'Date', nullable: true }),
})

export interface IChoicesQuestionResponse
  extends Omit<DB.QuestionResponse, 'lastResponse' | 'aggregatedResponses'> {
  elementType: DB.ElementType
  lastResponse: SingleQuestionResponseChoicesType
  aggregatedResponses: ElementResultsChoicesType
}
export const ChoicesQuestionResponse = builder
  .objectRef<IChoicesQuestionResponse>('ChoicesQuestionResponse')
  .implement({
    fields: (t) => ({
      ...sharedQuestionResponseProps(t),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseChoices,
      }),
      aggregatedResponses: t.expose('aggregatedResponses', {
        type: ElementResultsChoices,
      }),
    }),
  })

export interface IOpenQuestionResponse
  extends Omit<DB.QuestionResponse, 'lastResponse' | 'aggregatedResponses'> {
  elementType: DB.ElementType
  lastResponse: SingleQuestionResponseValueType
  aggregatedResponses: ElementResultsOpenType
}
export const OpenQuestionResponse = builder
  .objectRef<IOpenQuestionResponse>('OpenQuestionResponse')
  .implement({
    fields: (t) => ({
      ...sharedQuestionResponseProps(t),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseValue,
      }),
      aggregatedResponses: t.expose('aggregatedResponses', {
        type: ElementResultsOpen,
      }),
    }),
  })

export interface IFlashcardQuestionResponse
  extends Omit<DB.QuestionResponse, 'lastResponse' | 'aggregatedResponses'> {
  elementType: DB.ElementType
  lastResponse: SingleQuestionResponseFlashcardType
  aggregatedResponses: FlashcardResultsType
}
export const FlashcardQuestionResponse = builder
  .objectRef<IFlashcardQuestionResponse>('FlashcardQuestionResponse')
  .implement({
    fields: (t) => ({
      ...sharedQuestionResponseProps(t),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseFlashcard,
      }),
      aggregatedResponses: t.expose('aggregatedResponses', {
        type: ElementResultsFlashcard,
      }),
    }),
  })

export interface IContentQuestionResponse
  extends Omit<DB.QuestionResponse, 'lastResponse' | 'aggregatedResponses'> {
  elementType: DB.ElementType
  lastResponse: SingleQuestionResponseContentType
  aggregatedResponses: ContentResultsType
}
export const ContentQuestionResponse = builder
  .objectRef<IContentQuestionResponse>('ContentQuestionResponse')
  .implement({
    fields: (t) => ({
      ...sharedQuestionResponseProps(t),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseContent,
      }),
      aggregatedResponses: t.expose('aggregatedResponses', {
        type: ElementResultsContent,
      }),
    }),
  })

export const QuestionResponse = builder.unionType('QuestionResponse', {
  types: [
    ChoicesQuestionResponse,
    OpenQuestionResponse,
    FlashcardQuestionResponse,
    ContentQuestionResponse,
  ],
  resolveType: (response) => {
    switch (response.elementType) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return ChoicesQuestionResponse
      case DB.ElementType.NUMERICAL:
      case DB.ElementType.FREE_TEXT:
        return OpenQuestionResponse
      case DB.ElementType.FLASHCARD:
        return FlashcardQuestionResponse
      case DB.ElementType.CONTENT:
        return ContentQuestionResponse
    }
  },
})
// #endregion

// ----- EVALUATION VISUALIZATION TYPES -----
// #region
export interface ITabData {
  id: string
  questionIx?: number | null
  name: string
  status?: string | null
}
export const TabData = builder.objectRef<ITabData>('TabData').implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    questionIx: t.exposeInt('questionIx', { nullable: true }),
    name: t.exposeString('name'),
    status: t.exposeString('status', { nullable: true }),
  }),
})

export interface IEvaluationBlock {
  blockIx: number
  blockStatus: DB.SessionBlockStatus
  tabData: ITabData[]
}
export const EvaluationBlock = builder
  .objectRef<IEvaluationBlock>('EvaluationBlock')
  .implement({
    fields: (t) => ({
      blockIx: t.exposeInt('blockIx'),
      blockStatus: t.expose('blockStatus', { type: SessionBlockStatus }),
      tabData: t.expose('tabData', { type: [TabData] }),
    }),
  })

export interface ISessionEvaluation {
  id: string
  displayName: string
  status: DB.SessionStatus
  isGamificationEnabled: boolean
  blocks: IEvaluationBlock[]
  instanceResults: IInstanceResult[]
  feedbacks: IFeedback[]
  confusionFeedbacks: DB.ConfusionTimestep[]
}
export const SessionEvaluationRef =
  builder.objectRef<ISessionEvaluation>('SessionEvaluation')
export const SessionEvaluation = SessionEvaluationRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    displayName: t.exposeString('displayName'),
    status: t.field({
      type: SessionStatus,
      resolve: (evaluation) => evaluation.status,
    }),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),
    blocks: t.field({
      type: [EvaluationBlock],
      resolve: (evaluation) => evaluation.blocks,
    }),
    instanceResults: t.field({
      type: [InstanceResultRef],
      resolve: (evaluation) => evaluation.instanceResults,
    }),
    feedbacks: t.field({
      type: [FeedbackRef],
      resolve: (evaluation) => evaluation.feedbacks,
    }),
    confusionFeedbacks: t.field({
      type: [ConfusionTimestepRef],
      resolve: (evaluation) => evaluation.confusionFeedbacks,
    }),
  }),
})
// #endregion
