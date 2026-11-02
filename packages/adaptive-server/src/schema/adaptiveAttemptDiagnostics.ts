import type {
  AdaptivePermissionWrapper,
  AdaptiveSchemaBuilder,
} from '@klicker-uzh/graphql/adaptive-schema-host-types'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  AdaptiveAttemptDiagnosticDetail,
  AdaptiveAttemptDiagnosticsList,
  AdaptiveAttemptEstimateBackfill,
  AdaptiveAttemptRatingReason,
  AdaptiveAttemptReviewAccuracy,
  AdaptiveDiagnosticAnswer,
  AdaptiveDiagnosticNodeResult,
  AdaptiveDiagnosticReview,
  AdaptiveDiagnosticSummary,
} from '../services/adaptivePracticeQuizzes.js'
import * as AdaptivePracticeQuizRuntimeService from '../services/adaptivePracticeQuizzes.js'

type FieldBuilder = Parameters<
  Parameters<AdaptiveSchemaBuilder['mutationFields']>[0]
>[0]

// Lecturer attempt diagnostics (testing environments only). Enumerations are
// exposed as plain strings: this is a debugging read model, not a contract
// other clients branch on.
export function createAdaptiveAttemptDiagnosticsSchema(
  builder: AdaptiveSchemaBuilder
) {
  const RatingReasonType = builder
    .objectRef<AdaptiveAttemptRatingReason>('AdaptiveAttemptRatingReason')
    .implement({
      fields: (t) => ({
        code: t.exposeString('code'),
        severity: t.exposeString('severity'),
        nodeName: t.exposeString('nodeName', { nullable: true }),
        value: t.exposeFloat('value', { nullable: true }),
      }),
    })

  const NodeResultType = builder
    .objectRef<AdaptiveDiagnosticNodeResult>('AdaptiveAttemptNodeResult')
    .implement({
      fields: (t) => ({
        nodeId: t.exposeInt('nodeId', { nullable: true }),
        parentId: t.exposeInt('parentId', { nullable: true }),
        name: t.exposeString('name'),
        kind: t.exposeString('kind'),
        depth: t.exposeInt('depth'),
        theta: t.exposeFloat('theta', { nullable: true }),
        standardError: t.exposeFloat('standardError', { nullable: true }),
        levelLabel: t.exposeString('levelLabel', { nullable: true }),
        lowerLevelLabel: t.exposeString('lowerLevelLabel', { nullable: true }),
        upperLevelLabel: t.exposeString('upperLevelLabel', { nullable: true }),
        responseCount: t.exposeInt('responseCount'),
        determined: t.exposeBoolean('determined'),
        coverageStatus: t.exposeString('coverageStatus', { nullable: true }),
        weightShare: t.exposeFloat('weightShare', { nullable: true }),
      }),
    })

  const AnswerType = builder
    .objectRef<AdaptiveDiagnosticAnswer>('AdaptiveAttemptDiagnosticAnswer')
    .implement({
      fields: (t) => ({
        order: t.exposeInt('order'),
        competenceName: t.exposeString('competenceName', { nullable: true }),
        subcompetenceName: t.exposeString('subcompetenceName', {
          nullable: true,
        }),
        nodeNamePath: t.exposeStringList('nodeNamePath'),
        elementTitle: t.exposeString('elementTitle'),
        itemLevelLabel: t.exposeString('itemLevelLabel', { nullable: true }),
        difficulty: t.exposeFloat('difficulty', { nullable: true }),
        discrimination: t.exposeFloat('discrimination', { nullable: true }),
        guessing: t.exposeFloat('guessing', { nullable: true }),
        correct: t.exposeBoolean('correct'),
        score: t.exposeFloat('score'),
        overallThetaAfter: t.exposeFloat('overallThetaAfter', {
          nullable: true,
        }),
        levelDistance: t.exposeInt('levelDistance', { nullable: true }),
        phase: t.exposeString('phase'),
        competenceThetaBefore: t.exposeFloat('competenceThetaBefore', {
          nullable: true,
        }),
        competenceStandardErrorBefore: t.exposeFloat(
          'competenceStandardErrorBefore',
          { nullable: true }
        ),
        competenceLevelBefore: t.exposeString('competenceLevelBefore', {
          nullable: true,
        }),
        competenceThetaAfter: t.exposeFloat('competenceThetaAfter', {
          nullable: true,
        }),
        competenceStandardErrorAfter: t.exposeFloat(
          'competenceStandardErrorAfter',
          { nullable: true }
        ),
        competenceLevelAfter: t.exposeString('competenceLevelAfter', {
          nullable: true,
        }),
        competenceLowerLevelAfter: t.exposeString('competenceLowerLevelAfter', {
          nullable: true,
        }),
        competenceUpperLevelAfter: t.exposeString('competenceUpperLevelAfter', {
          nullable: true,
        }),
        levelDistanceBefore: t.exposeInt('levelDistanceBefore', {
          nullable: true,
        }),
      }),
    })

  const ExpectedLevelType = builder
    .objectRef<{ nodeId: number; levelLabel: string }>(
      'AdaptiveAttemptExpectedLevel'
    )
    .implement({
      fields: (t) => ({
        nodeId: t.exposeInt('nodeId'),
        levelLabel: t.exposeString('levelLabel'),
      }),
    })

  const ReviewRef = builder.objectRef<AdaptiveDiagnosticReview>(
    'AdaptiveAttemptReview'
  )
  ReviewRef.implement({
    fields: (t) => ({
      verdict: t.exposeString('verdict'),
      expectedOverallLevelLabel: t.exposeString('expectedOverallLevelLabel', {
        nullable: true,
      }),
      expectedCompetenceLevels: t.expose('expectedCompetenceLevels', {
        type: [ExpectedLevelType],
      }),
      comment: t.exposeString('comment', { nullable: true }),
      updatedAt: t.expose('updatedAt', { type: 'Date' }),
    }),
  })

  const SummaryType = builder
    .objectRef<AdaptiveDiagnosticSummary>('AdaptiveAttemptDiagnosticSummary')
    .implement({
      fields: (t) => ({
        attemptCode: t.exposeString('attemptCode'),
        participantCode: t.exposeString('participantCode'),
        attemptNumber: t.exposeInt('attemptNumber'),
        startedAt: t.expose('startedAt', { type: 'Date' }),
        completedAt: t.expose('completedAt', { type: 'Date', nullable: true }),
        elapsedSeconds: t.exposeInt('elapsedSeconds', { nullable: true }),
        stopReason: t.exposeString('stopReason', { nullable: true }),
        answerCount: t.exposeInt('answerCount'),
        overall: t.expose('overall', { type: NodeResultType }),
        competences: t.expose('competences', { type: [NodeResultType] }),
        rating: t.exposeString('rating'),
        ratingReasons: t.expose('ratingReasons', { type: [RatingReasonType] }),
        answers: t.expose('answers', { type: [AnswerType] }),
        estimatesComplete: t.exposeBoolean('estimatesComplete'),
        review: t.expose('review', { type: ReviewRef, nullable: true }),
      }),
    })

  const AccuracyType = builder
    .objectRef<AdaptiveAttemptReviewAccuracy>('AdaptiveAttemptReviewAccuracy')
    .implement({
      fields: (t) => ({
        reviewedAttempts: t.exposeInt('reviewedAttempts'),
        asExpected: t.exposeInt('asExpected'),
        tooHigh: t.exposeInt('tooHigh'),
        tooLow: t.exposeInt('tooLow'),
        unsure: t.exposeInt('unsure'),
        levelComparisons: t.exposeInt('levelComparisons'),
        exactShare: t.exposeFloat('exactShare', { nullable: true }),
        withinOneLevelShare: t.exposeFloat('withinOneLevelShare', {
          nullable: true,
        }),
        meanLevelDifference: t.exposeFloat('meanLevelDifference', {
          nullable: true,
        }),
        meanAbsoluteLevelDifference: t.exposeFloat(
          'meanAbsoluteLevelDifference',
          { nullable: true }
        ),
      }),
    })

  const AdaptiveAttemptDiagnosticsRef = builder
    .objectRef<AdaptiveAttemptDiagnosticsList>('AdaptiveAttemptDiagnostics')
    .implement({
      fields: (t) => ({
        levelLabels: t.exposeStringList('levelLabels'),
        attempts: t.expose('attempts', { type: [SummaryType] }),
        earlierPublicationAttemptCount: t.exposeInt(
          'earlierPublicationAttemptCount'
        ),
        incompleteEstimateAttemptCount: t.exposeInt(
          'incompleteEstimateAttemptCount'
        ),
        accuracy: t.expose('accuracy', { type: AccuracyType }),
      }),
    })

  const AdaptiveAttemptDiagnosticRef = builder
    .objectRef<AdaptiveAttemptDiagnosticDetail>('AdaptiveAttemptDiagnostic')
    .implement({
      fields: (t) => ({
        levelLabels: t.exposeStringList('levelLabels'),
        summary: t.expose('summary', { type: SummaryType }),
        nodes: t.expose('nodes', { type: [NodeResultType] }),
      }),
    })

  const AdaptiveAttemptExpectedLevelInput = builder
    .inputRef<{ nodeId: number; levelLabel: string }>(
      'AdaptiveAttemptExpectedLevelInput'
    )
    .implement({
      fields: (t) => ({
        nodeId: t.int({ required: true }),
        levelLabel: t.string({ required: true }),
      }),
    })

  const AdaptiveAttemptEstimateBackfillRef = builder
    .objectRef<AdaptiveAttemptEstimateBackfill>(
      'AdaptiveAttemptEstimateBackfill'
    )
    .implement({
      fields: (t) => ({
        attemptsMissing: t.exposeInt('attemptsMissing'),
        attemptsUpdated: t.exposeInt('attemptsUpdated'),
        answersUpdated: t.exposeInt('answersUpdated'),
        attemptsReplayDiffering: t.exposeInt('attemptsReplayDiffering'),
        attemptsFailed: t.exposeInt('attemptsFailed'),
      }),
    })

  return {
    AdaptiveAttemptDiagnosticsRef,
    AdaptiveAttemptDiagnosticRef,
    AdaptiveAttemptReviewRef: ReviewRef,
    AdaptiveAttemptExpectedLevelInput,
    AdaptiveAttemptEstimateBackfillRef,
  }
}

// Testing environments only; the service refuses elsewhere. Same lecturer
// permission as the diagnostics queries.
export function adaptiveAttemptDiagnosticsMutationFields(
  t: FieldBuilder,
  {
    withPermission,
    AdaptiveAttemptReviewRef,
    AdaptiveAttemptExpectedLevelInput,
    AdaptiveAttemptEstimateBackfillRef,
  }: {
    withPermission: AdaptivePermissionWrapper
  } & Pick<
    ReturnType<typeof createAdaptiveAttemptDiagnosticsSchema>,
    | 'AdaptiveAttemptReviewRef'
    | 'AdaptiveAttemptExpectedLevelInput'
    | 'AdaptiveAttemptEstimateBackfillRef'
  >
) {
  const asUser = { authenticated: true, role: DB.UserRole.USER }
  return {
    backfillAdaptivePracticeQuizAttemptEstimates: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveAttemptEstimateBackfillRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizRuntimeService.backfillAdaptivePracticeQuizAttemptEstimates(
            args,
            ctx
          )
      ),
    }),

    saveAdaptivePracticeQuizAttemptReview: t.withAuth(asUser).field({
      nullable: true,
      type: AdaptiveAttemptReviewRef,
      args: {
        practiceQuizId: t.arg.string({ required: true }),
        attemptCode: t.arg.string({ required: true }),
        verdict: t.arg.string({ required: true }),
        expectedOverallLevelLabel: t.arg.string({ required: false }),
        expectedCompetenceLevels: t.arg({
          type: [AdaptiveAttemptExpectedLevelInput],
          required: false,
        }),
        comment: t.arg.string({ required: false }),
      },
      resolve: withPermission(
        (args) => ({ practiceQuizId: args.practiceQuizId }),
        DB.PermissionLevel.ADMIN,
        async (_, args, ctx) =>
          await AdaptivePracticeQuizRuntimeService.saveAdaptivePracticeQuizAttemptReview(
            args,
            ctx
          )
      ),
    }),
  }
}
