import type { AdaptiveSchemaBuilder } from '@klicker-uzh/graphql/adaptive-schema-host-types'
import * as DB from '@klicker-uzh/prisma/client'
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
  type AdaptiveResultClassification,
  type AdaptiveResultConfidence,
  type AdaptiveResultLevelBand,
  type AdaptiveResultTrajectoryPoint,
  type AdaptiveStudentResult,
  type AdaptiveStudentResultNode,
  type AdaptiveSubmittedResponseFeedback,
  type AdaptiveTestingCompetenceSnapshot,
  type AdaptiveTestingEstimate,
  type AdaptiveTestingHistory,
  type AdaptiveTestingHistoryEntry,
  type AdaptiveTestingInfo,
  type AdaptiveTestingSolution,
  loadAdaptiveTestingElementTags,
} from '../services/adaptivePracticeQuizzes.js'
import type { createCompetenceTreeSchema } from './competenceTree.js'

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
type AdaptiveBoxPlot = NonNullable<AdaptivePilotMetrics['questionCountBoxPlot']>

type AdaptiveParticipantChoice = ParticipantChoicesOptions['choices'][number]
export function createAdaptivePracticeQuizRuntimeSchema(
  builder: AdaptiveSchemaBuilder,
  {
    AdaptiveLevelMappingRule,
    AdaptiveNodeKind,
    ElementDisplayMode,
    ElementType,
    FreeTextRestrictions,
    NumericalRestrictions,
  }: {
    AdaptiveLevelMappingRule: ReturnType<
      typeof createCompetenceTreeSchema
    >['AdaptiveLevelMappingRule']
    AdaptiveNodeKind: ReturnType<
      typeof createCompetenceTreeSchema
    >['AdaptiveNodeKind']
    ElementDisplayMode: typeof import('@klicker-uzh/graphql/adaptive-schema-host-types')['ElementDisplayMode']
    ElementType: typeof import('@klicker-uzh/graphql/adaptive-schema-host-types')['ElementType']
    FreeTextRestrictions: typeof import('@klicker-uzh/graphql/adaptive-schema-host-types')['FreeTextRestrictions']
    NumericalRestrictions: typeof import('@klicker-uzh/graphql/adaptive-schema-host-types')['NumericalRestrictions']
  }
) {
  const AdaptivePracticeQuizAttemptStatus = builder.enumType(
    'AdaptivePracticeQuizAttemptStatus',
    { values: Object.values(DB.AdaptivePracticeQuizAttemptStatus) }
  )
  const AdaptivePracticeQuizStopReason = builder.enumType(
    'AdaptivePracticeQuizStopReason',
    { values: Object.values(DB.AdaptivePracticeQuizStopReason) }
  )
  const AdaptiveEstimateNodeKind = builder.enumType(
    'AdaptiveEstimateNodeKind',
    { values: Object.values(DB.AdaptiveEstimateNodeKind) }
  )
  const AdaptiveResultConfidenceType = builder.enumType(
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
  const AdaptiveResultClassificationType = builder.enumType(
    'AdaptivePracticeQuizResultClassification',
    {
      values: Object.values(
        DB.AdaptiveResultStatus
      ) as AdaptiveResultClassification[],
    }
  )
  const AdaptivePrivacyFieldType = builder.enumType(
    'AdaptivePracticeQuizPrivacyField',
    { values: ADAPTIVE_PRIVACY_FIELDS }
  )
  const AdaptivePrivacySuppressionReasonType = builder.enumType(
    'AdaptivePracticeQuizPrivacySuppressionReason',
    { values: ADAPTIVE_PRIVACY_SUPPRESSION_REASONS }
  )

  const AdaptivePrivacySuppressionRef =
    builder.objectRef<AdaptivePrivacySuppression>(
      'AdaptivePracticeQuizPrivacySuppression'
    )
  const AdaptivePrivacySuppressionType =
    AdaptivePrivacySuppressionRef.implement({
      fields: (t) => ({
        field: t.expose('field', { type: AdaptivePrivacyFieldType }),
        reason: t.expose('reason', {
          type: AdaptivePrivacySuppressionReasonType,
        }),
      }),
    })
  const AdaptivePracticeQuizResponseInputRef =
    builder.inputRef<AdaptivePracticeQuizResponseInputType>(
      'AdaptivePracticeQuizResponseInput'
    )
  const AdaptivePracticeQuizResponseInput =
    AdaptivePracticeQuizResponseInputRef.implement({
      fields: (t) => ({
        choiceIndices: t.intList({ required: false }),
        numericalResponse: t.string({ required: false }),
        freeTextResponse: t.string({ required: false }),
      }),
    })
  const AdaptiveParticipantChoiceRef =
    builder.objectRef<AdaptiveParticipantChoice>('AdaptivePracticeQuizChoice')
  const AdaptiveParticipantChoiceType = AdaptiveParticipantChoiceRef.implement({
    fields: (t) => ({
      ix: t.exposeInt('ix'),
      value: t.exposeString('value'),
    }),
  })

  const AdaptiveChoicesOptionsRef =
    builder.objectRef<ParticipantChoicesOptions>(
      'AdaptivePracticeQuizChoicesOptions'
    )
  const AdaptiveChoicesOptionsType = AdaptiveChoicesOptionsRef.implement({
    fields: (t) => ({
      displayMode: t.expose('displayMode', { type: ElementDisplayMode }),
      choices: t.expose('choices', { type: [AdaptiveParticipantChoiceRef] }),
    }),
  })

  const AdaptiveNumericalOptionsRef =
    builder.objectRef<ParticipantNumericalOptions>(
      'AdaptivePracticeQuizNumericalOptions'
    )
  const AdaptiveNumericalOptionsType = AdaptiveNumericalOptionsRef.implement({
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
  const AdaptiveFreeTextOptionsType = AdaptiveFreeTextOptionsRef.implement({
    fields: (t) => ({
      restrictions: t.expose('restrictions', {
        type: FreeTextRestrictions,
        nullable: true,
      }),
    }),
  })
  const AdaptiveParticipantElementOptions = builder.unionType(
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

  // Testing-only objects: populated solely when the server runs with
  // ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true (staging walkthroughs); null otherwise.
  const AdaptiveTestingSolutionType = builder
    .objectRef<AdaptiveTestingSolution>('AdaptivePracticeQuizTestingSolution')
    .implement({
      fields: (t) => ({
        choiceIndices: t.exposeIntList('choiceIndices'),
        answers: t.exposeStringList('answers'),
      }),
    })

  const AdaptiveTestingEstimateType = builder
    .objectRef<AdaptiveTestingEstimate>('AdaptivePracticeQuizTestingEstimate')
    .implement({
      fields: (t) => ({
        responseCount: t.exposeInt('responseCount'),
        theta: t.exposeFloat('theta', { nullable: true }),
        standardError: t.exposeFloat('standardError', { nullable: true }),
        lowerBound: t.exposeFloat('lowerBound', { nullable: true }),
        upperBound: t.exposeFloat('upperBound', { nullable: true }),
        levelLabel: t.exposeString('levelLabel', { nullable: true }),
        levelIsTentative: t.exposeBoolean('levelIsTentative'),
        resultStatus: t.expose('resultStatus', {
          type: AdaptiveResultClassificationType,
          nullable: true,
        }),
      }),
    })

  const AdaptiveTestingAnswerResultType = builder.enumType(
    'AdaptivePracticeQuizTestingAnswerResult',
    { values: ['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT'] as const }
  )

  const AdaptiveTestingHistoryEntryType = builder
    .objectRef<AdaptiveTestingHistoryEntry>(
      'AdaptivePracticeQuizTestingHistoryEntry'
    )
    .implement({
      fields: (t) => ({
        order: t.exposeInt('order'),
        elementTitle: t.exposeString('elementTitle'),
        competenceName: t.exposeString('competenceName', { nullable: true }),
        subcompetenceName: t.exposeString('subcompetenceName', {
          nullable: true,
        }),
        itemLevelLabel: t.exposeString('itemLevelLabel', { nullable: true }),
        itemLevelPosition: t.exposeFloat('itemLevelPosition', {
          nullable: true,
        }),
        result: t.expose('result', { type: AdaptiveTestingAnswerResultType }),
        score: t.exposeFloat('score'),
        overallTheta: t.exposeFloat('overallTheta', { nullable: true }),
        overallPosition: t.exposeFloat('overallPosition', { nullable: true }),
      }),
    })

  const AdaptiveTestingCompetenceSnapshotType = builder
    .objectRef<AdaptiveTestingCompetenceSnapshot>(
      'AdaptivePracticeQuizTestingCompetenceSnapshot'
    )
    .implement({
      fields: (t) => ({
        name: t.exposeString('name'),
        responseCount: t.exposeInt('responseCount'),
        theta: t.exposeFloat('theta', { nullable: true }),
        levelLabel: t.exposeString('levelLabel', { nullable: true }),
        levelIsTentative: t.exposeBoolean('levelIsTentative'),
        position: t.exposeFloat('position', { nullable: true }),
        lowerPosition: t.exposeFloat('lowerPosition', { nullable: true }),
        upperPosition: t.exposeFloat('upperPosition', { nullable: true }),
      }),
    })

  const AdaptiveTestingHistoryType = builder
    .objectRef<AdaptiveTestingHistory>('AdaptivePracticeQuizTestingHistory')
    .implement({
      fields: (t) => ({
        levelBands: t.expose('levelBands', {
          type: [AdaptiveResultLevelBandRef],
        }),
        entries: t.expose('entries', {
          type: [AdaptiveTestingHistoryEntryType],
        }),
        competenceEstimates: t.expose('competenceEstimates', {
          type: [AdaptiveTestingCompetenceSnapshotType],
        }),
      }),
    })

  const AdaptiveTestingInfoType = builder
    .objectRef<AdaptiveTestingInfo>('AdaptivePracticeQuizTestingInfo')
    .implement({
      fields: (t) => ({
        solution: t.expose('solution', { type: AdaptiveTestingSolutionType }),
        elementId: t.exposeInt('elementId'),
        elementVersion: t.exposeInt('elementVersion'),
        elementTitle: t.exposeString('elementTitle'),
        elementTags: t.stringList({
          resolve: (info, _args, ctx) =>
            loadAdaptiveTestingElementTags(ctx.prisma, info.elementId),
        }),
        competencePath: t.exposeStringList('competencePath'),
        subcompetenceName: t.exposeString('subcompetenceName', {
          nullable: true,
        }),
        itemLevelLabel: t.exposeString('itemLevelLabel'),
        overallEstimate: t.expose('overallEstimate', {
          type: AdaptiveTestingEstimateType,
          nullable: true,
        }),
        competenceEstimate: t.expose('competenceEstimate', {
          type: AdaptiveTestingEstimateType,
          nullable: true,
        }),
        subcompetenceEstimate: t.expose('subcompetenceEstimate', {
          type: AdaptiveTestingEstimateType,
          nullable: true,
        }),
        history: t.expose('history', {
          type: AdaptiveTestingHistoryType,
          nullable: true,
        }),
      }),
    })

  const AdaptiveParticipantElementRef =
    builder.objectRef<AdaptiveParticipantElement>(
      'AdaptivePracticeQuizServedItem'
    )
  const AdaptiveParticipantElementType =
    AdaptiveParticipantElementRef.implement({
      fields: (t) => ({
        poolItemId: t.exposeInt('poolItemId'),
        elementId: t.exposeInt('elementId'),
        name: t.exposeString('name'),
        type: t.expose('type', { type: ElementType }),
        content: t.exposeString('content'),
        testingInfo: t.expose('testingInfo', {
          type: AdaptiveTestingInfoType,
          nullable: true,
        }),
        options: t.expose('options', {
          type: AdaptiveParticipantElementOptions,
        }),
      }),
    })

  const AdaptiveSubmittedResponseFeedbackRef =
    builder.objectRef<AdaptiveSubmittedResponseFeedback>(
      'AdaptivePracticeQuizSubmittedResponseFeedback'
    )
  const AdaptiveSubmittedResponseFeedbackType =
    AdaptiveSubmittedResponseFeedbackRef.implement({
      fields: (t) => ({
        correct: t.exposeBoolean('correct'),
        score: t.exposeFloat('score'),
        feedback: t.exposeStringList('feedback'),
      }),
    })
  const AdaptivePracticeQuizAttemptStateRef =
    builder.objectRef<AdaptivePracticeQuizAttemptState>(
      'AdaptivePracticeQuizAttemptState'
    )
  const AdaptivePracticeQuizAttemptStateType =
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
        timeLimitSeconds: t.exposeInt('timeLimitSeconds', { nullable: true }),
        deadlineAt: t.expose('deadlineAt', { type: 'Date', nullable: true }),
        startedAt: t.expose('startedAt', { type: 'Date' }),
        completedAt: t.expose('completedAt', {
          type: 'Date',
          nullable: true,
        }),
        elapsedSeconds: t.exposeInt('elapsedSeconds', { nullable: true }),
        showTimer: t.exposeBoolean('showTimer'),
        canStartNewAttempt: t.exposeBoolean('canStartNewAttempt'),
        nextAttemptAvailableAt: t.expose('nextAttemptAvailableAt', {
          type: 'Date',
          nullable: true,
        }),
        submittedResponseFeedback: t.expose('submittedResponseFeedback', {
          type: AdaptiveSubmittedResponseFeedbackRef,
          nullable: true,
        }),
        servedItem: t.expose('servedItem', {
          type: AdaptiveParticipantElementRef,
          nullable: true,
        }),
      }),
    })

  const AdaptiveResultLevelBandRef = builder.objectRef<AdaptiveResultLevelBand>(
    'AdaptivePracticeQuizLevelBand'
  )
  const AdaptiveResultLevelBandType = AdaptiveResultLevelBandRef.implement({
    fields: (t) => ({
      label: t.exposeString('label'),
      order: t.exposeInt('order'),
      startPosition: t.exposeFloat('startPosition'),
      endPosition: t.exposeFloat('endPosition'),
      color: t.string({
        nullable: true,
        resolve: ({ color }) => color ?? null,
      }),
    }),
  })

  const AdaptiveResultTrajectoryPointRef =
    builder.objectRef<AdaptiveResultTrajectoryPoint>(
      'AdaptivePracticeQuizTrajectoryPoint'
    )
  const AdaptiveResultTrajectoryPointType =
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
    builder.objectRef<AdaptiveStudentResultNode>(
      'AdaptivePracticeQuizResultNode'
    )
  const AdaptiveStudentResultNodeType = AdaptiveStudentResultNodeRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
      kind: t.expose('kind', { type: AdaptiveNodeKind }),
      order: t.exposeInt('order'),
      responseCount: t.exposeInt('responseCount'),
      classification: t.expose('classification', {
        type: AdaptiveResultClassificationType,
      }),
      levelLabel: t.exposeString('levelLabel', { nullable: true }),
      roughLevelLabel: t.exposeString('roughLevelLabel', { nullable: true }),
      leadingLevelLabels: t.exposeStringList('leadingLevelLabels'),
      classificationProbability: t.exposeFloat('classificationProbability', {
        nullable: true,
      }),
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
  const AdaptiveStudentResultRef = builder.objectRef<AdaptiveStudentResult>(
    'AdaptivePracticeQuizResult'
  )
  const AdaptiveStudentResultType = AdaptiveStudentResultRef.implement({
    fields: (t) => ({
      attemptId: t.exposeString('attemptId'),
      practiceQuizId: t.exposeString('practiceQuizId'),
      practiceQuizName: t.exposeString('practiceQuizName'),
      stopReason: t.expose('stopReason', {
        type: AdaptivePracticeQuizStopReason,
      }),
      answeredQuestions: t.exposeInt('answeredQuestions'),
      completedAt: t.expose('completedAt', { type: 'Date' }),
      isPlacementPilot: t.exposeBoolean('isPlacementPilot'),
      levelInterpretation: t.expose('levelInterpretation', {
        type: AdaptiveLevelMappingRule,
      }),
      classification: t.expose('classification', {
        type: AdaptiveResultClassificationType,
      }),
      levelLabel: t.exposeString('levelLabel', { nullable: true }),
      leadingLevelLabels: t.exposeStringList('leadingLevelLabels'),
      classificationProbability: t.exposeFloat('classificationProbability', {
        nullable: true,
      }),
      confidence: t.expose('confidence', {
        type: AdaptiveResultConfidenceType,
      }),
      nearBoundary: t.exposeBoolean('nearBoundary'),
      position: t.exposeFloat('position', { nullable: true }),
      lowerPosition: t.exposeFloat('lowerPosition', { nullable: true }),
      upperPosition: t.exposeFloat('upperPosition', { nullable: true }),
      levelBands: t.expose('levelBands', {
        type: [AdaptiveResultLevelBandRef],
      }),
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
  const AdaptiveCohortLevelBucketType = AdaptiveCohortLevelBucketRef.implement({
    fields: (t) => ({
      levelLabel: t.exposeString('levelLabel'),
      levelOrder: t.exposeInt('levelOrder'),
      count: t.exposeInt('count'),
      determinedCount: t.int({
        resolve: (bucket) => bucket.determinedCount ?? 0,
      }),
    }),
  })

  const AdaptiveCohortNodeDistributionRef =
    builder.objectRef<AdaptiveCohortNodeDistribution>(
      'AdaptivePracticeQuizNodeDistribution'
    )
  const AdaptiveCohortNodeDistributionType =
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
        notTestedCount: t.exposeInt('notTestedCount', { nullable: true }),
        classifiedCount: t.exposeInt('classifiedCount', { nullable: true }),
        betweenLevelsCount: t.exposeInt('betweenLevelsCount', {
          nullable: true,
        }),
        insufficientEvidenceCount: t.exposeInt('insufficientEvidenceCount', {
          nullable: true,
        }),
        poolLimitedCount: t.exposeInt('poolLimitedCount', { nullable: true }),
        researchOnlyCount: t.exposeInt('researchOnlyCount', { nullable: true }),
        buckets: t.expose('buckets', { type: [AdaptiveCohortLevelBucketRef] }),
      }),
    })

  const AdaptiveCohortAttemptSummaryRef =
    builder.objectRef<AdaptiveCohortAttemptSummary>(
      'AdaptivePracticeQuizCohortAttemptSummary'
    )
  const AdaptiveCohortAttemptSummaryType =
    AdaptiveCohortAttemptSummaryRef.implement({
      fields: (t) => ({
        suppressed: t.exposeBoolean('suppressed'),
        suppressions: t.expose('suppressions', {
          type: [AdaptivePrivacySuppressionRef],
        }),
        classified: t.exposeInt('classified', { nullable: true }),
        betweenLevels: t.exposeInt('betweenLevels', { nullable: true }),
        insufficientEvidence: t.exposeInt('insufficientEvidence', {
          nullable: true,
        }),
        poolLimited: t.exposeInt('poolLimited', { nullable: true }),
        researchOnly: t.exposeInt('researchOnly', { nullable: true }),
        capped: t.exposeInt('capped', { nullable: true }),
        poolExhausted: t.exposeInt('poolExhausted', { nullable: true }),
        stoppedInsufficientData: t.exposeInt('stoppedInsufficientData', {
          nullable: true,
        }),
        insufficientData: t.exposeInt('insufficientData', { nullable: true }),
        // Deprecated model-derived metric; current releases return null.
        nearBoundary: t.exposeInt('nearBoundary', { nullable: true }),
      }),
    })

  const AdaptiveBoxPlotRef = builder
    .objectRef<AdaptiveBoxPlot>('AdaptivePracticeQuizBoxPlot')
    .implement({
      fields: (t) => ({
        min: t.exposeFloat('min'),
        q1: t.exposeFloat('q1'),
        median: t.exposeFloat('median'),
        q3: t.exposeFloat('q3'),
        max: t.exposeFloat('max'),
        count: t.exposeInt('count'),
      }),
    })

  const AdaptivePilotMetricsRef = builder.objectRef<AdaptivePilotMetrics>(
    'AdaptivePracticeQuizPilotMetrics'
  )
  const AdaptivePilotMetricsType = AdaptivePilotMetricsRef.implement({
    fields: (t) => ({
      suppressed: t.exposeBoolean('suppressed'),
      suppressions: t.expose('suppressions', {
        type: [AdaptivePrivacySuppressionRef],
      }),
      questionCountBoxPlot: t.expose('questionCountBoxPlot', {
        type: AdaptiveBoxPlotRef,
        nullable: true,
      }),
      completionTimeBoxPlot: t.expose('completionTimeBoxPlot', {
        type: AdaptiveBoxPlotRef,
        nullable: true,
      }),
      medianQuestionCount: t.exposeFloat('medianQuestionCount', {
        nullable: true,
      }),
      p95QuestionCount: t.exposeFloat('p95QuestionCount', { nullable: true }),
      medianElapsedSeconds: t.exposeFloat('medianElapsedSeconds', {
        nullable: true,
      }),
      p95ElapsedSeconds: t.exposeFloat('p95ElapsedSeconds', { nullable: true }),
      // Deprecated model-derived metric; current releases return null.
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
  const AdaptiveItemDiagnosticType = AdaptiveItemDiagnosticRef.implement({
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
  const AdaptiveCohortResultsRef = builder.objectRef<AdaptiveCohortResults>(
    'AdaptivePracticeQuizCohortResults'
  )
  const AdaptiveCohortResultsType = AdaptiveCohortResultsRef.implement({
    fields: (t) => ({
      practiceQuizId: t.exposeString('practiceQuizId'),
      competenceTreeId: t.exposeString('competenceTreeId'),
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
  return {
    AdaptivePracticeQuizAttemptStatus,
    AdaptivePracticeQuizStopReason,
    AdaptiveEstimateNodeKind,
    AdaptiveResultConfidenceType,
    AdaptiveResultClassificationType,
    AdaptivePrivacyFieldType,
    AdaptivePrivacySuppressionReasonType,
    AdaptivePrivacySuppressionType,
    AdaptivePracticeQuizResponseInputRef,
    AdaptivePracticeQuizResponseInput,
    AdaptiveParticipantChoiceType,
    AdaptiveChoicesOptionsType,
    AdaptiveNumericalOptionsType,
    AdaptiveFreeTextOptionsType,
    AdaptiveParticipantElementOptions,
    AdaptiveParticipantElementType,
    AdaptiveSubmittedResponseFeedbackType,
    AdaptivePracticeQuizAttemptStateRef,
    AdaptivePracticeQuizAttemptStateType,
    AdaptiveResultLevelBandType,
    AdaptiveResultTrajectoryPointType,
    AdaptiveStudentResultNodeType,
    AdaptiveStudentResultRef,
    AdaptiveStudentResultType,
    AdaptiveCohortLevelBucketType,
    AdaptiveCohortNodeDistributionType,
    AdaptiveCohortAttemptSummaryType,
    AdaptivePilotMetricsType,
    AdaptiveItemDiagnosticType,
    AdaptiveCohortResultsRef,
    AdaptiveCohortResultsType,
  }
}
