import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import {
  ADAPTIVE_PRIVACY_FIELDS,
  ADAPTIVE_PRIVACY_SUPPRESSION_REASONS,
  type AdaptiveCohortAttemptSummary,
  type AdaptiveCohortLevelBucket,
  type AdaptiveCohortNodeDistribution,
  type AdaptiveCohortResults,
  type AdaptiveItemDiagnostic,
  type AdaptiveParticipantElement,
  type AdaptivePilotMetrics,
  type AdaptivePracticeQuizAttemptState,
  type AdaptivePracticeQuizResponseInput as AdaptivePracticeQuizResponseInputType,
  type AdaptivePrivacySuppression,
  type AdaptiveResultConfidence,
  type AdaptiveResultLevelBand,
  type AdaptiveResultTrajectoryPoint,
  type AdaptiveStudentResult,
  type AdaptiveStudentResultNode,
} from '../services/adaptivePracticeQuizzes.js'
import { AdaptiveLevelMappingRule, AdaptiveNodeKind } from './competenceTree.js'
import {
  ElementDisplayMode,
  ElementType,
  FreeTextRestrictions,
  NumericalRestrictions,
} from './elementData.js'

export const AdaptivePracticeQuizAttemptStatus = builder.enumType(
  'AdaptivePracticeQuizAttemptStatus',
  { values: Object.values(DB.AdaptivePracticeQuizAttemptStatus) }
)

export const AdaptivePracticeQuizStopReason = builder.enumType(
  'AdaptivePracticeQuizStopReason',
  { values: Object.values(DB.AdaptivePracticeQuizStopReason) }
)

export const AdaptiveEstimateNodeKind = builder.enumType(
  'AdaptiveEstimateNodeKind',
  { values: Object.values(DB.AdaptiveEstimateNodeKind) }
)

export const AdaptiveResultConfidenceType = builder.enumType(
  'AdaptiveResultConfidence',
  {
    values: [
      'HIGH',
      'MODERATE',
      'LOW',
      'INSUFFICIENT_DATA',
    ] as const satisfies readonly AdaptiveResultConfidence[],
  }
)

export const AdaptivePrivacyFieldType = builder.enumType(
  'AdaptivePracticeQuizPrivacyField',
  { values: ADAPTIVE_PRIVACY_FIELDS }
)

export const AdaptivePrivacySuppressionReasonType = builder.enumType(
  'AdaptivePracticeQuizPrivacySuppressionReason',
  { values: ADAPTIVE_PRIVACY_SUPPRESSION_REASONS }
)

const AdaptivePrivacySuppressionRef =
  builder.objectRef<AdaptivePrivacySuppression>(
    'AdaptivePracticeQuizPrivacySuppression'
  )
export const AdaptivePrivacySuppressionType =
  AdaptivePrivacySuppressionRef.implement({
    fields: (t) => ({
      field: t.expose('field', { type: AdaptivePrivacyFieldType }),
      reason: t.expose('reason', {
        type: AdaptivePrivacySuppressionReasonType,
      }),
    }),
  })

export const AdaptivePracticeQuizResponseInputRef =
  builder.inputRef<AdaptivePracticeQuizResponseInputType>(
    'AdaptivePracticeQuizResponseInput'
  )
export const AdaptivePracticeQuizResponseInput =
  AdaptivePracticeQuizResponseInputRef.implement({
    fields: (t) => ({
      choiceIndices: t.intList({ required: false }),
      numericalResponse: t.string({ required: false }),
      freeTextResponse: t.string({ required: false }),
    }),
  })

type ParticipantElementOptions = AdaptiveParticipantElement['options']
type ParticipantChoicesOptions = Extract<
  ParticipantElementOptions,
  { kind: 'CHOICES' }
>
type ParticipantNumericalOptions = Extract<
  ParticipantElementOptions,
  { kind: 'NUMERICAL' }
>
type ParticipantFreeTextOptions = Extract<
  ParticipantElementOptions,
  { kind: 'FREE_TEXT' }
>

type AdaptiveParticipantChoice = ParticipantChoicesOptions['choices'][number]
const AdaptiveParticipantChoiceRef =
  builder.objectRef<AdaptiveParticipantChoice>('AdaptivePracticeQuizChoice')
export const AdaptiveParticipantChoiceType =
  AdaptiveParticipantChoiceRef.implement({
    fields: (t) => ({
      ix: t.exposeInt('ix'),
      value: t.exposeString('value'),
    }),
  })

const AdaptiveChoicesOptionsRef = builder.objectRef<ParticipantChoicesOptions>(
  'AdaptivePracticeQuizChoicesOptions'
)
export const AdaptiveChoicesOptionsType = AdaptiveChoicesOptionsRef.implement({
  fields: (t) => ({
    displayMode: t.expose('displayMode', { type: ElementDisplayMode }),
    choices: t.expose('choices', { type: [AdaptiveParticipantChoiceRef] }),
  }),
})

const AdaptiveNumericalOptionsRef =
  builder.objectRef<ParticipantNumericalOptions>(
    'AdaptivePracticeQuizNumericalOptions'
  )
export const AdaptiveNumericalOptionsType =
  AdaptiveNumericalOptionsRef.implement({
    fields: (t) => ({
      unit: t.exposeString('unit', { nullable: true }),
      accuracy: t.exposeInt('accuracy', { nullable: true }),
      placeholder: t.exposeString('placeholder', { nullable: true }),
      restrictions: t.expose('restrictions', {
        type: NumericalRestrictions,
        nullable: true,
      }),
      enablePercentInput: t.exposeBoolean('enablePercentInput'),
    }),
  })

const AdaptiveFreeTextOptionsRef =
  builder.objectRef<ParticipantFreeTextOptions>(
    'AdaptivePracticeQuizFreeTextOptions'
  )
export const AdaptiveFreeTextOptionsType = AdaptiveFreeTextOptionsRef.implement(
  {
    fields: (t) => ({
      restrictions: t.expose('restrictions', {
        type: FreeTextRestrictions,
        nullable: true,
      }),
    }),
  }
)

export const AdaptiveParticipantElementOptions = builder.unionType(
  'AdaptivePracticeQuizElementOptions',
  {
    types: [
      AdaptiveChoicesOptionsRef,
      AdaptiveNumericalOptionsRef,
      AdaptiveFreeTextOptionsRef,
    ],
    resolveType: (options) => {
      switch (options.kind) {
        case 'CHOICES':
          return AdaptiveChoicesOptionsRef
        case 'NUMERICAL':
          return AdaptiveNumericalOptionsRef
        case 'FREE_TEXT':
          return AdaptiveFreeTextOptionsRef
      }
    },
  }
)

const AdaptiveParticipantElementRef =
  builder.objectRef<AdaptiveParticipantElement>(
    'AdaptivePracticeQuizServedItem'
  )
export const AdaptiveParticipantElementType =
  AdaptiveParticipantElementRef.implement({
    fields: (t) => ({
      poolItemId: t.exposeInt('poolItemId'),
      elementId: t.exposeInt('elementId'),
      name: t.exposeString('name'),
      type: t.expose('type', { type: ElementType }),
      content: t.exposeString('content'),
      options: t.expose('options', {
        type: AdaptiveParticipantElementOptions,
      }),
    }),
  })

export const AdaptivePracticeQuizAttemptStateRef =
  builder.objectRef<AdaptivePracticeQuizAttemptState>(
    'AdaptivePracticeQuizAttemptState'
  )
export const AdaptivePracticeQuizAttemptStateType =
  AdaptivePracticeQuizAttemptStateRef.implement({
    fields: (t) => ({
      attemptId: t.exposeString('attemptId'),
      practiceQuizId: t.exposeString('practiceQuizId'),
      practiceQuizName: t.exposeString('practiceQuizName'),
      status: t.expose('status', { type: AdaptivePracticeQuizAttemptStatus }),
      stopReason: t.expose('stopReason', {
        type: AdaptivePracticeQuizStopReason,
        nullable: true,
      }),
      answeredQuestions: t.exposeInt('answeredQuestions'),
      questionNumber: t.exposeInt('questionNumber', { nullable: true }),
      maximumQuestions: t.exposeInt('maximumQuestions'),
      startedAt: t.expose('startedAt', { type: 'Date' }),
      completedAt: t.expose('completedAt', {
        type: 'Date',
        nullable: true,
      }),
      elapsedSeconds: t.exposeInt('elapsedSeconds', { nullable: true }),
      showTimer: t.exposeBoolean('showTimer'),
      canStartNewAttempt: t.exposeBoolean('canStartNewAttempt'),
      servedItem: t.expose('servedItem', {
        type: AdaptiveParticipantElementRef,
        nullable: true,
      }),
    }),
  })

const AdaptiveResultLevelBandRef = builder.objectRef<AdaptiveResultLevelBand>(
  'AdaptivePracticeQuizLevelBand'
)
export const AdaptiveResultLevelBandType = AdaptiveResultLevelBandRef.implement(
  {
    fields: (t) => ({
      label: t.exposeString('label'),
      order: t.exposeInt('order'),
      startPosition: t.exposeFloat('startPosition'),
      endPosition: t.exposeFloat('endPosition'),
    }),
  }
)

const AdaptiveResultTrajectoryPointRef =
  builder.objectRef<AdaptiveResultTrajectoryPoint>(
    'AdaptivePracticeQuizTrajectoryPoint'
  )
export const AdaptiveResultTrajectoryPointType =
  AdaptiveResultTrajectoryPointRef.implement({
    fields: (t) => ({
      order: t.exposeInt('order'),
      position: t.exposeFloat('position'),
      lowerPosition: t.exposeFloat('lowerPosition'),
      upperPosition: t.exposeFloat('upperPosition'),
      levelLabel: t.exposeString('levelLabel', { nullable: true }),
    }),
  })

const AdaptiveStudentResultNodeRef =
  builder.objectRef<AdaptiveStudentResultNode>('AdaptivePracticeQuizResultNode')
export const AdaptiveStudentResultNodeType =
  AdaptiveStudentResultNodeRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
      kind: t.expose('kind', { type: AdaptiveNodeKind }),
      order: t.exposeInt('order'),
      responseCount: t.exposeInt('responseCount'),
      levelLabel: t.exposeString('levelLabel', { nullable: true }),
      confidence: t.expose('confidence', {
        type: AdaptiveResultConfidenceType,
      }),
      nearBoundary: t.exposeBoolean('nearBoundary'),
      position: t.exposeFloat('position', { nullable: true }),
      lowerPosition: t.exposeFloat('lowerPosition', { nullable: true }),
      upperPosition: t.exposeFloat('upperPosition', { nullable: true }),
      children: t.expose('children', {
        type: [AdaptiveStudentResultNodeRef],
      }),
    }),
  })

export const AdaptiveStudentResultRef =
  builder.objectRef<AdaptiveStudentResult>('AdaptivePracticeQuizResult')
export const AdaptiveStudentResultType = AdaptiveStudentResultRef.implement({
  fields: (t) => ({
    attemptId: t.exposeString('attemptId'),
    practiceQuizId: t.exposeString('practiceQuizId'),
    practiceQuizName: t.exposeString('practiceQuizName'),
    stopReason: t.expose('stopReason', {
      type: AdaptivePracticeQuizStopReason,
    }),
    answeredQuestions: t.exposeInt('answeredQuestions'),
    completedAt: t.expose('completedAt', { type: 'Date' }),
    levelInterpretation: t.expose('levelInterpretation', {
      type: AdaptiveLevelMappingRule,
    }),
    levelLabel: t.exposeString('levelLabel', { nullable: true }),
    confidence: t.expose('confidence', {
      type: AdaptiveResultConfidenceType,
    }),
    nearBoundary: t.exposeBoolean('nearBoundary'),
    position: t.exposeFloat('position', { nullable: true }),
    lowerPosition: t.exposeFloat('lowerPosition', { nullable: true }),
    upperPosition: t.exposeFloat('upperPosition', { nullable: true }),
    levelBands: t.expose('levelBands', { type: [AdaptiveResultLevelBandRef] }),
    trajectory: t.expose('trajectory', {
      type: [AdaptiveResultTrajectoryPointRef],
    }),
    competenceProfile: t.expose('competenceProfile', {
      type: [AdaptiveStudentResultNodeRef],
    }),
  }),
})

const AdaptiveCohortLevelBucketRef =
  builder.objectRef<AdaptiveCohortLevelBucket>(
    'AdaptivePracticeQuizLevelBucket'
  )
export const AdaptiveCohortLevelBucketType =
  AdaptiveCohortLevelBucketRef.implement({
    fields: (t) => ({
      levelLabel: t.exposeString('levelLabel'),
      levelOrder: t.exposeInt('levelOrder'),
      count: t.exposeInt('count'),
    }),
  })

const AdaptiveCohortNodeDistributionRef =
  builder.objectRef<AdaptiveCohortNodeDistribution>(
    'AdaptivePracticeQuizNodeDistribution'
  )
export const AdaptiveCohortNodeDistributionType =
  AdaptiveCohortNodeDistributionRef.implement({
    fields: (t) => ({
      nodeId: t.exposeInt('nodeId', { nullable: true }),
      parentNodeId: t.exposeInt('parentNodeId', { nullable: true }),
      nodeName: t.exposeString('nodeName'),
      nodeKind: t.expose('nodeKind', { type: AdaptiveEstimateNodeKind }),
      depth: t.exposeInt('depth'),
      order: t.exposeInt('order'),
      suppressed: t.exposeBoolean('suppressed'),
      suppressions: t.expose('suppressions', {
        type: [AdaptivePrivacySuppressionRef],
      }),
      insufficientDataCount: t.exposeInt('insufficientDataCount', {
        nullable: true,
      }),
      buckets: t.expose('buckets', { type: [AdaptiveCohortLevelBucketRef] }),
    }),
  })

const AdaptiveCohortAttemptSummaryRef =
  builder.objectRef<AdaptiveCohortAttemptSummary>(
    'AdaptivePracticeQuizCohortAttemptSummary'
  )
export const AdaptiveCohortAttemptSummaryType =
  AdaptiveCohortAttemptSummaryRef.implement({
    fields: (t) => ({
      suppressed: t.exposeBoolean('suppressed'),
      suppressions: t.expose('suppressions', {
        type: [AdaptivePrivacySuppressionRef],
      }),
      classified: t.exposeInt('classified', { nullable: true }),
      capped: t.exposeInt('capped', { nullable: true }),
      poolExhausted: t.exposeInt('poolExhausted', { nullable: true }),
      stoppedInsufficientData: t.exposeInt('stoppedInsufficientData', {
        nullable: true,
      }),
      insufficientData: t.exposeInt('insufficientData', { nullable: true }),
      nearBoundary: t.exposeInt('nearBoundary', { nullable: true }),
    }),
  })

const AdaptivePilotMetricsRef = builder.objectRef<AdaptivePilotMetrics>(
  'AdaptivePracticeQuizPilotMetrics'
)
export const AdaptivePilotMetricsType = AdaptivePilotMetricsRef.implement({
  fields: (t) => ({
    suppressed: t.exposeBoolean('suppressed'),
    suppressions: t.expose('suppressions', {
      type: [AdaptivePrivacySuppressionRef],
    }),
    medianQuestionCount: t.exposeFloat('medianQuestionCount', {
      nullable: true,
    }),
    p95QuestionCount: t.exposeFloat('p95QuestionCount', { nullable: true }),
    medianElapsedSeconds: t.exposeFloat('medianElapsedSeconds', {
      nullable: true,
    }),
    p95ElapsedSeconds: t.exposeFloat('p95ElapsedSeconds', { nullable: true }),
    nearBoundaryRate: t.exposeFloat('nearBoundaryRate', { nullable: true }),
    responseCountMismatchDetected: t.exposeBoolean(
      'responseCountMismatchDetected',
      { nullable: true }
    ),
    durationMissingDetected: t.exposeBoolean('durationMissingDetected', {
      nullable: true,
    }),
  }),
})

const AdaptiveItemDiagnosticRef = builder.objectRef<AdaptiveItemDiagnostic>(
  'AdaptivePracticeQuizItemDiagnostic'
)
export const AdaptiveItemDiagnosticType = AdaptiveItemDiagnosticRef.implement({
  fields: (t) => ({
    poolItemId: t.exposeInt('poolItemId'),
    elementName: t.exposeString('elementName'),
    elementType: t.expose('elementType', { type: ElementType }),
    nodeNamePath: t.exposeStringList('nodeNamePath'),
    levelLabel: t.exposeString('levelLabel'),
    suppressed: t.exposeBoolean('suppressed'),
    suppressions: t.expose('suppressions', {
      type: [AdaptivePrivacySuppressionRef],
    }),
    responseCount: t.exposeInt('responseCount', { nullable: true }),
    exposureRate: t.exposeFloat('exposureRate', { nullable: true }),
    observedCorrectRate: t.exposeFloat('observedCorrectRate', {
      nullable: true,
    }),
    expectedCorrectRate: t.exposeFloat('expectedCorrectRate', {
      nullable: true,
    }),
    residual: t.exposeFloat('residual', { nullable: true }),
    highExposure: t.exposeBoolean('highExposure', { nullable: true }),
    misfitFlag: t.exposeBoolean('misfitFlag', { nullable: true }),
  }),
})

export const AdaptiveCohortResultsRef =
  builder.objectRef<AdaptiveCohortResults>('AdaptivePracticeQuizCohortResults')
export const AdaptiveCohortResultsType = AdaptiveCohortResultsRef.implement({
  fields: (t) => ({
    practiceQuizId: t.exposeString('practiceQuizId'),
    cohortSize: t.exposeInt('cohortSize', { nullable: true }),
    suppressed: t.exposeBoolean('suppressed'),
    attemptSummary: t.expose('attemptSummary', {
      type: AdaptiveCohortAttemptSummaryRef,
    }),
    pilotMetrics: t.expose('pilotMetrics', { type: AdaptivePilotMetricsRef }),
    itemDiagnostics: t.expose('itemDiagnostics', {
      type: [AdaptiveItemDiagnosticRef],
    }),
    distributions: t.expose('distributions', {
      type: [AdaptiveCohortNodeDistributionRef],
    }),
  }),
})
