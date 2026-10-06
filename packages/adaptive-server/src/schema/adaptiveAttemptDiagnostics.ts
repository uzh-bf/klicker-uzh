import type { AdaptiveSchemaBuilder } from '@klicker-uzh/graphql/adaptive-schema-host-types'
import type {
  AdaptiveAttemptDiagnosticDetail,
  AdaptiveAttemptDiagnosticsList,
} from '../services/adaptivePracticeQuizAttemptDiagnostics.js'
import type {
  AdaptiveDiagnosticAnswer,
  AdaptiveDiagnosticNodeResult,
  AdaptiveDiagnosticSummary,
} from '../services/adaptivePracticeQuizAttemptDiagnosticsModel.js'
import type { AdaptiveAttemptRatingReason } from '../services/adaptivePracticeQuizAttemptDiagnosticsRating.js'
import type {
  AdaptiveAnswerReplay,
  AdaptiveAttemptReplay,
} from '../services/adaptivePracticeQuizAttemptReplay.js'

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
      }),
    })

  const AnswerReplayType = builder
    .objectRef<AdaptiveAnswerReplay>('AdaptiveAttemptAnswerReplay')
    .implement({
      fields: (t) => ({
        order: t.exposeInt('order'),
        phase: t.exposeString('phase'),
        competenceThetaBefore: t.exposeFloat('competenceThetaBefore', {
          nullable: true,
        }),
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
        replayMatches: t.exposeBoolean('replayMatches'),
      }),
    })

  const AttemptReplayType = builder
    .objectRef<AdaptiveAttemptReplay>('AdaptiveAttemptReplay')
    .implement({
      fields: (t) => ({
        exact: t.exposeBoolean('exact'),
        answers: t.expose('answers', { type: [AnswerReplayType] }),
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
      }),
    })

  const AdaptiveAttemptDiagnosticRef = builder
    .objectRef<AdaptiveAttemptDiagnosticDetail>('AdaptiveAttemptDiagnostic')
    .implement({
      fields: (t) => ({
        levelLabels: t.exposeStringList('levelLabels'),
        summary: t.expose('summary', { type: SummaryType }),
        nodes: t.expose('nodes', { type: [NodeResultType] }),
        answers: t.expose('answers', { type: [AnswerType] }),
        replay: t.expose('replay', {
          type: AttemptReplayType,
          nullable: true,
        }),
        replayError: t.exposeString('replayError', { nullable: true }),
      }),
    })

  return { AdaptiveAttemptDiagnosticsRef, AdaptiveAttemptDiagnosticRef }
}
