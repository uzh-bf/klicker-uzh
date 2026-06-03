import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type {
  AdaptiveAnswerInput as AdaptiveAnswerInputType,
  AdaptiveAssessmentResults as AdaptiveAssessmentResultsType,
  AdaptiveAssessmentWithConfig,
  AdaptiveAttemptProgress as AdaptiveAttemptProgressType,
  AdaptiveAttemptState as AdaptiveAttemptStateType,
  AdaptiveCompetenceEstimate as AdaptiveCompetenceEstimateType,
  AdaptiveCompetenceInput as AdaptiveCompetenceInputType,
  AdaptiveElementInput as AdaptiveElementInputType,
  AdaptiveItemPoolPreviewRow as AdaptiveItemPoolPreviewRowType,
  AdaptiveItemResultRow as AdaptiveItemResultRowType,
  AdaptiveLevelDistributionBin as AdaptiveLevelDistributionBinType,
  AdaptiveLevelInput as AdaptiveLevelInputType,
  AdaptiveResultMessageInput as AdaptiveResultMessageInputType,
  AdaptiveStudentResultRow as AdaptiveStudentResultRowType,
  AdaptiveStudentStanding as AdaptiveStudentStandingType,
  AdaptiveSubCompetenceEstimate as AdaptiveSubCompetenceEstimateType,
  AdaptiveSubCompetenceInput as AdaptiveSubCompetenceInputType,
  PublishedAdaptiveAssessmentInfo as PublishedAdaptiveAssessmentInfoType,
  UpsertAdaptiveAssessmentInput as UpsertAdaptiveAssessmentInputType,
} from '../services/adaptiveLearning.js'
import { AdaptiveOverviewAttemptMode as AdaptiveOverviewAttemptModeType } from '../services/adaptiveLearning.js'
import { Element } from './element.js'
import { PublicationStatus } from './practiceQuiz.js'

export const AdaptiveAssessmentAttemptStatus = builder.enumType(
  'AdaptiveAssessmentAttemptStatus',
  {
    values: Object.values(DB.AdaptiveAssessmentAttemptStatus),
  }
)

export const AdaptiveOverviewAttemptMode = builder.enumType(
  'AdaptiveOverviewAttemptMode',
  {
    values: Object.values(AdaptiveOverviewAttemptModeType),
  }
)

export const AdaptiveAssessmentLevelRef =
  builder.objectRef<DB.AdaptiveAssessmentLevel>('AdaptiveAssessmentLevel')
export const AdaptiveAssessmentLevel = AdaptiveAssessmentLevelRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    label: t.exposeString('label'),
    order: t.exposeInt('order'),
  }),
})

export const AdaptiveAssessmentSubCompetenceRef =
  builder.objectRef<DB.AdaptiveAssessmentSubCompetence>(
    'AdaptiveAssessmentSubCompetence'
  )
export const AdaptiveAssessmentSubCompetence =
  AdaptiveAssessmentSubCompetenceRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
      tagName: t.exposeString('tagName', { nullable: true }),
      enabled: t.exposeBoolean('enabled'),
      order: t.exposeInt('order'),
      questionThreshold: t.exposeInt('questionThreshold', { nullable: true }),
      standardErrorThreshold: t.exposeFloat('standardErrorThreshold', {
        nullable: true,
      }),
    }),
  })

export interface IAdaptiveAssessmentCompetence
  extends DB.AdaptiveAssessmentCompetence {
  subCompetences?: DB.AdaptiveAssessmentSubCompetence[]
}
export const AdaptiveAssessmentCompetenceRef =
  builder.objectRef<IAdaptiveAssessmentCompetence>(
    'AdaptiveAssessmentCompetence'
  )
export const AdaptiveAssessmentCompetence =
  AdaptiveAssessmentCompetenceRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
      tagName: t.exposeString('tagName', { nullable: true }),
      enabled: t.exposeBoolean('enabled'),
      order: t.exposeInt('order'),
      weight: t.exposeFloat('weight'),
      questionThreshold: t.exposeInt('questionThreshold', { nullable: true }),
      standardErrorThreshold: t.exposeFloat('standardErrorThreshold', {
        nullable: true,
      }),
      subCompetences: t.expose('subCompetences', {
        type: [AdaptiveAssessmentSubCompetenceRef],
        nullable: true,
      }),
    }),
  })

export interface IAdaptiveAssessmentElement
  extends DB.AdaptiveAssessmentElement {
  element?: DB.Element
  competence?: DB.AdaptiveAssessmentCompetence
  subCompetence?: DB.AdaptiveAssessmentSubCompetence
  level?: DB.AdaptiveAssessmentLevel
}
export const AdaptiveAssessmentElementRef =
  builder.objectRef<IAdaptiveAssessmentElement>('AdaptiveAssessmentElement')
export const AdaptiveAssessmentElement = AdaptiveAssessmentElementRef.implement(
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      enabled: t.exposeBoolean('enabled'),
      exposure: t.exposeInt('exposure'),
      discrimination: t.exposeFloat('discrimination', { nullable: true }),
      elementId: t.exposeInt('elementId'),
      element: t.expose('element', { type: Element, nullable: true }),
      competence: t.expose('competence', {
        type: AdaptiveAssessmentCompetenceRef,
        nullable: true,
      }),
      subCompetence: t.expose('subCompetence', {
        type: AdaptiveAssessmentSubCompetenceRef,
        nullable: true,
      }),
      level: t.expose('level', {
        type: AdaptiveAssessmentLevelRef,
        nullable: true,
      }),
    }),
  }
)

export interface IAdaptiveAssessmentResultMessage
  extends DB.AdaptiveAssessmentResultMessage {
  level?: DB.AdaptiveAssessmentLevel | null
}
export const AdaptiveAssessmentResultMessageRef =
  builder.objectRef<IAdaptiveAssessmentResultMessage>(
    'AdaptiveAssessmentResultMessage'
  )
export const AdaptiveAssessmentResultMessage =
  AdaptiveAssessmentResultMessageRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      order: t.exposeInt('order'),
      message: t.exposeString('message'),
      minTheta: t.exposeFloat('minTheta', { nullable: true }),
      maxTheta: t.exposeFloat('maxTheta', { nullable: true }),
      isFallback: t.exposeBoolean('isFallback'),
      level: t.expose('level', {
        type: AdaptiveAssessmentLevelRef,
        nullable: true,
      }),
    }),
  })

export const AdaptiveAssessmentRef =
  builder.objectRef<AdaptiveAssessmentWithConfig>('AdaptiveAssessment')
export const AdaptiveAssessment = AdaptiveAssessmentRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    status: t.expose('status', { type: PublicationStatus }),
    isDeleted: t.exposeBoolean('isDeleted'),
    thetaMin: t.exposeFloat('thetaMin'),
    thetaMax: t.exposeFloat('thetaMax'),
    discrimination: t.exposeFloat('discrimination'),
    standardErrorThreshold: t.exposeFloat('standardErrorThreshold'),
    questionThreshold: t.exposeInt('questionThreshold'),
    topInformationRatio: t.exposeFloat('topInformationRatio'),
    showTimer: t.exposeBoolean('showTimer'),
    showCompetenceNames: t.exposeBoolean('showCompetenceNames'),
    showFinalResult: t.exposeBoolean('showFinalResult'),
    showSolutions: t.exposeBoolean('showSolutions'),
    courseId: t.exposeString('courseId'),
    levels: t.expose('levels', { type: [AdaptiveAssessmentLevelRef] }),
    competences: t.expose('competences', {
      type: [AdaptiveAssessmentCompetenceRef],
    }),
    elements: t.expose('elements', { type: [AdaptiveAssessmentElementRef] }),
    resultMessages: t.expose('resultMessages', {
      type: [AdaptiveAssessmentResultMessageRef],
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export const PublishedAdaptiveAssessmentInfoRef =
  builder.objectRef<PublishedAdaptiveAssessmentInfoType>(
    'PublishedAdaptiveAssessmentInfo'
  )
export const PublishedAdaptiveAssessmentInfo =
  PublishedAdaptiveAssessmentInfoRef.implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      courseName: t.exposeString('courseName'),
      displayName: t.exposeString('displayName'),
      description: t.exposeString('description', { nullable: true }),
      thetaMin: t.exposeFloat('thetaMin'),
      thetaMax: t.exposeFloat('thetaMax'),
      standardErrorThreshold: t.exposeFloat('standardErrorThreshold'),
      levels: t.expose('levels', { type: [AdaptiveAssessmentLevelRef] }),
    }),
  })

export const AdaptiveAssessmentAttemptRef =
  builder.objectRef<DB.AdaptiveAssessmentAttempt>('AdaptiveAssessmentAttempt')
export const AdaptiveAssessmentAttempt = AdaptiveAssessmentAttemptRef.implement(
  {
    fields: (t) => ({
      id: t.exposeString('id'),
      status: t.expose('status', { type: AdaptiveAssessmentAttemptStatus }),
      currentTheta: t.exposeFloat('currentTheta'),
      currentStandardError: t.exposeFloat('currentStandardError', {
        nullable: true,
      }),
      finalTheta: t.exposeFloat('finalTheta', { nullable: true }),
      finalStandardError: t.exposeFloat('finalStandardError', {
        nullable: true,
      }),
      finalLevelLabel: t.exposeString('finalLevelLabel', { nullable: true }),
      elapsedSeconds: t.exposeInt('elapsedSeconds', { nullable: true }),
      startedAt: t.expose('startedAt', { type: 'Date' }),
      completedAt: t.expose('completedAt', { type: 'Date', nullable: true }),
    }),
  }
)

export const AdaptiveAttemptProgressRef =
  builder.objectRef<AdaptiveAttemptProgressType>('AdaptiveAttemptProgress')
export const AdaptiveAttemptProgress = AdaptiveAttemptProgressRef.implement({
  fields: (t) => ({
    answeredQuestions: t.exposeInt('answeredQuestions'),
    maxQuestions: t.exposeInt('maxQuestions'),
    standardError: t.exposeFloat('standardError'),
    theta: t.exposeFloat('theta'),
    levelLabel: t.exposeString('levelLabel', { nullable: true }),
    completed: t.exposeBoolean('completed'),
    elapsedSeconds: t.exposeInt('elapsedSeconds'),
    message: t.exposeString('message', { nullable: true }),
    messages: t.exposeStringList('messages'),
  }),
})

export const AdaptiveAttemptStateRef =
  builder.objectRef<AdaptiveAttemptStateType>('AdaptiveAttemptState')
export const AdaptiveAttemptState = AdaptiveAttemptStateRef.implement({
  fields: (t) => ({
    attempt: t.expose('attempt', { type: AdaptiveAssessmentAttemptRef }),
    assessment: t.expose('assessment', { type: AdaptiveAssessmentRef }),
    nextElement: t.expose('nextElement', { type: Element, nullable: true }),
    nextAdaptiveElementId: t.exposeInt('nextAdaptiveElementId', {
      nullable: true,
    }),
    nextCompetenceName: t.exposeString('nextCompetenceName', {
      nullable: true,
    }),
    nextSubCompetenceName: t.exposeString('nextSubCompetenceName', {
      nullable: true,
    }),
    progress: t.expose('progress', { type: AdaptiveAttemptProgressRef }),
  }),
})

export const AdaptiveItemPoolPreviewRowRef =
  builder.objectRef<AdaptiveItemPoolPreviewRowType>(
    'AdaptiveItemPoolPreviewRow'
  )
export const AdaptiveItemPoolPreviewRow =
  AdaptiveItemPoolPreviewRowRef.implement({
    fields: (t) => ({
      competenceName: t.exposeString('competenceName'),
      subCompetenceName: t.exposeString('subCompetenceName'),
      levelLabel: t.exposeString('levelLabel'),
      count: t.exposeInt('count'),
    }),
  })

export const AdaptiveCompetenceEstimateRef =
  builder.objectRef<AdaptiveCompetenceEstimateType>(
    'AdaptiveCompetenceEstimate'
  )
export const AdaptiveSubCompetenceEstimateRef =
  builder.objectRef<AdaptiveSubCompetenceEstimateType>(
    'AdaptiveSubCompetenceEstimate'
  )
export const AdaptiveSubCompetenceEstimate =
  AdaptiveSubCompetenceEstimateRef.implement({
    fields: (t) => ({
      subCompetenceId: t.exposeInt('subCompetenceId'),
      subCompetenceName: t.exposeString('subCompetenceName'),
      theta: t.exposeFloat('theta', { nullable: true }),
      standardError: t.exposeFloat('standardError', { nullable: true }),
      levelLabel: t.exposeString('levelLabel', { nullable: true }),
      answeredQuestions: t.exposeInt('answeredQuestions'),
    }),
  })
export const AdaptiveCompetenceEstimate =
  AdaptiveCompetenceEstimateRef.implement({
    fields: (t) => ({
      competenceId: t.exposeInt('competenceId'),
      competenceName: t.exposeString('competenceName'),
      weight: t.exposeFloat('weight'),
      theta: t.exposeFloat('theta', { nullable: true }),
      standardError: t.exposeFloat('standardError', { nullable: true }),
      levelLabel: t.exposeString('levelLabel', { nullable: true }),
      answeredQuestions: t.exposeInt('answeredQuestions'),
      subCompetences: t.expose('subCompetences', {
        type: [AdaptiveSubCompetenceEstimateRef],
      }),
    }),
  })

export const AdaptiveLevelDistributionBinRef =
  builder.objectRef<AdaptiveLevelDistributionBinType>(
    'AdaptiveLevelDistributionBin'
  )
export const AdaptiveLevelDistributionBin =
  AdaptiveLevelDistributionBinRef.implement({
    fields: (t) => ({
      levelLabel: t.exposeString('levelLabel'),
      minTheta: t.exposeFloat('minTheta'),
      maxTheta: t.exposeFloat('maxTheta'),
      count: t.exposeInt('count'),
    }),
  })

export const AdaptiveStudentStandingRef =
  builder.objectRef<AdaptiveStudentStandingType>('AdaptiveStudentStanding')
export const AdaptiveStudentStanding = AdaptiveStudentStandingRef.implement({
  fields: (t) => ({
    attemptId: t.exposeString('attemptId', { nullable: true }),
    assessmentId: t.exposeString('assessmentId'),
    assessmentName: t.exposeString('assessmentName'),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    completedAt: t.expose('completedAt', { type: 'Date', nullable: true }),
    answeredQuestions: t.exposeInt('answeredQuestions'),
    theta: t.exposeFloat('theta'),
    standardError: t.exposeFloat('standardError'),
    levelLabel: t.exposeString('levelLabel', { nullable: true }),
    message: t.exposeString('message', { nullable: true }),
    messages: t.exposeStringList('messages'),
    competences: t.expose('competences', {
      type: [AdaptiveCompetenceEstimateRef],
    }),
  }),
})

export const AdaptiveStudentResultRowRef =
  builder.objectRef<AdaptiveStudentResultRowType>('AdaptiveStudentResultRow')
export const AdaptiveStudentResultRow = AdaptiveStudentResultRowRef.implement({
  fields: (t) => ({
    assessmentId: t.exposeString('assessmentId'),
    assessmentName: t.exposeString('assessmentName'),
    participantId: t.exposeString('participantId'),
    participantUsername: t.exposeString('participantUsername'),
    participantEmail: t.exposeString('participantEmail', { nullable: true }),
    attemptId: t.exposeString('attemptId', { nullable: true }),
    attemptNumber: t.exposeInt('attemptNumber'),
    isLatestAttempt: t.exposeBoolean('isLatestAttempt'),
    status: t.expose('status', {
      type: AdaptiveAssessmentAttemptStatus,
      nullable: true,
    }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    completedAt: t.expose('completedAt', { type: 'Date', nullable: true }),
    answeredQuestions: t.exposeInt('answeredQuestions'),
    theta: t.exposeFloat('theta'),
    standardError: t.exposeFloat('standardError'),
    levelLabel: t.exposeString('levelLabel', { nullable: true }),
    message: t.exposeString('message', { nullable: true }),
    messages: t.exposeStringList('messages'),
    competences: t.expose('competences', {
      type: [AdaptiveCompetenceEstimateRef],
    }),
  }),
})

export const AdaptiveItemResultRowRef =
  builder.objectRef<AdaptiveItemResultRowType>('AdaptiveItemResultRow')
export const AdaptiveItemResultRow = AdaptiveItemResultRowRef.implement({
  fields: (t) => ({
    adaptiveElementId: t.exposeInt('adaptiveElementId'),
    elementId: t.exposeInt('elementId'),
    elementName: t.exposeString('elementName'),
    competenceName: t.exposeString('competenceName'),
    subCompetenceName: t.exposeString('subCompetenceName'),
    levelLabel: t.exposeString('levelLabel'),
    difficulty: t.exposeFloat('difficulty'),
    discrimination: t.exposeFloat('discrimination'),
    guessing: t.exposeFloat('guessing'),
    exposure: t.exposeInt('exposure'),
    responseCount: t.exposeInt('responseCount'),
    correctCount: t.exposeInt('correctCount'),
    accuracy: t.exposeFloat('accuracy', { nullable: true }),
  }),
})

export const AdaptiveAssessmentResultsRef =
  builder.objectRef<AdaptiveAssessmentResultsType>('AdaptiveAssessmentResults')
export const AdaptiveAssessmentResults = AdaptiveAssessmentResultsRef.implement(
  {
    fields: (t) => ({
      assessmentId: t.exposeString('assessmentId'),
      participantCount: t.exposeInt('participantCount'),
      completedCount: t.exposeInt('completedCount'),
      inProgressCount: t.exposeInt('inProgressCount'),
      attemptCount: t.exposeInt('attemptCount'),
      completedAttemptCount: t.exposeInt('completedAttemptCount'),
      completionRate: t.exposeFloat('completionRate'),
      classMeanTheta: t.exposeFloat('classMeanTheta', { nullable: true }),
      meanStandardError: t.exposeFloat('meanStandardError', {
        nullable: true,
      }),
      averageAnsweredQuestions: t.exposeFloat('averageAnsweredQuestions', {
        nullable: true,
      }),
      distribution: t.expose('distribution', {
        type: [AdaptiveLevelDistributionBinRef],
      }),
      competences: t.expose('competences', {
        type: [AdaptiveCompetenceEstimateRef],
      }),
      students: t.expose('students', { type: [AdaptiveStudentResultRowRef] }),
      items: t.expose('items', { type: [AdaptiveItemResultRowRef] }),
    }),
  }
)

export const AdaptiveLevelInputRef =
  builder.inputRef<AdaptiveLevelInputType>('AdaptiveLevelInput')
export const AdaptiveLevelInput = AdaptiveLevelInputRef.implement({
  fields: (t) => ({
    label: t.string({ required: true }),
    order: t.int({ required: true }),
  }),
})

export const AdaptiveSubCompetenceInputRef =
  builder.inputRef<AdaptiveSubCompetenceInputType>('AdaptiveSubCompetenceInput')
export const AdaptiveSubCompetenceInput =
  AdaptiveSubCompetenceInputRef.implement({
    fields: (t) => ({
      name: t.string({ required: true }),
      tagName: t.string({ required: false }),
      enabled: t.boolean({ required: true }),
      order: t.int({ required: true }),
      questionThreshold: t.int({ required: false }),
      standardErrorThreshold: t.float({ required: false }),
    }),
  })

export const AdaptiveCompetenceInputRef =
  builder.inputRef<AdaptiveCompetenceInputType>('AdaptiveCompetenceInput')
export const AdaptiveCompetenceInput = AdaptiveCompetenceInputRef.implement({
  fields: (t) => ({
    name: t.string({ required: true }),
    tagName: t.string({ required: false }),
    enabled: t.boolean({ required: true }),
    order: t.int({ required: true }),
    weight: t.float({ required: false }),
    questionThreshold: t.int({ required: false }),
    standardErrorThreshold: t.float({ required: false }),
    subCompetences: t.field({
      type: [AdaptiveSubCompetenceInputRef],
      required: true,
    }),
  }),
})

export const AdaptiveElementInputRef =
  builder.inputRef<AdaptiveElementInputType>('AdaptiveElementInput')
export const AdaptiveElementInput = AdaptiveElementInputRef.implement({
  fields: (t) => ({
    elementId: t.int({ required: true }),
    competenceName: t.string({ required: true }),
    subCompetenceName: t.string({ required: true }),
    levelLabel: t.string({ required: true }),
    enabled: t.boolean({ required: true }),
    discrimination: t.float({ required: false }),
  }),
})

export const AdaptiveResultMessageInputRef =
  builder.inputRef<AdaptiveResultMessageInputType>('AdaptiveResultMessageInput')
export const AdaptiveResultMessageInput =
  AdaptiveResultMessageInputRef.implement({
    fields: (t) => ({
      order: t.int({ required: true }),
      message: t.string({ required: true }),
      minTheta: t.float({ required: false }),
      maxTheta: t.float({ required: false }),
      levelLabel: t.string({ required: false }),
      isFallback: t.boolean({ required: true }),
    }),
  })

export const UpsertAdaptiveAssessmentInputRef =
  builder.inputRef<UpsertAdaptiveAssessmentInputType>(
    'UpsertAdaptiveAssessmentInput'
  )
export const UpsertAdaptiveAssessmentInput =
  UpsertAdaptiveAssessmentInputRef.implement({
    fields: (t) => ({
      id: t.string({ required: false }),
      courseId: t.string({ required: true }),
      name: t.string({ required: true }),
      displayName: t.string({ required: true }),
      description: t.string({ required: false }),
      levels: t.field({ type: [AdaptiveLevelInputRef], required: true }),
      competences: t.field({
        type: [AdaptiveCompetenceInputRef],
        required: true,
      }),
      elements: t.field({ type: [AdaptiveElementInputRef], required: true }),
      resultMessages: t.field({
        type: [AdaptiveResultMessageInputRef],
        required: true,
      }),
      standardErrorThreshold: t.float({ required: false }),
      questionThreshold: t.int({ required: false }),
      discrimination: t.float({ required: false }),
      thetaMin: t.float({ required: false }),
      thetaMax: t.float({ required: false }),
      topInformationRatio: t.float({ required: false }),
      showTimer: t.boolean({ required: false }),
      showCompetenceNames: t.boolean({ required: false }),
      showFinalResult: t.boolean({ required: false }),
      showSolutions: t.boolean({ required: false }),
    }),
  })

export const AdaptiveChoiceResponseInputRef = builder.inputRef<{
  ix: number
  selected: boolean
}>('AdaptiveChoiceResponseInput')
export const AdaptiveChoiceResponseInput =
  AdaptiveChoiceResponseInputRef.implement({
    fields: (t) => ({
      ix: t.int({ required: true }),
      selected: t.boolean({ required: true }),
    }),
  })

export const AdaptiveAnswerInputRef = builder.inputRef<AdaptiveAnswerInputType>(
  'AdaptiveAnswerInput'
)
export const AdaptiveAnswerInput = AdaptiveAnswerInputRef.implement({
  fields: (t) => ({
    choicesResponse: t.field({
      type: [AdaptiveChoiceResponseInputRef],
      required: false,
    }),
    freeTextResponse: t.string({ required: false }),
  }),
})
