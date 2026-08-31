import * as DB from '@klicker-uzh/prisma/client'
import type {
  FreeTextEvaluationFeedback,
  FreeTextFeedback,
  FreeTextRubricFeedback,
} from '@klicker-uzh/types'
import builder, { DateScalar } from '../builder.js'
import type {
  FreeTextAttemptState,
  FreeTextPracticeState,
  SemanticFreeTextCapabilityData,
} from '../services/freeTextEvaluation.js'

export const FreeTextPracticeCycleStatus = builder.enumType(
  'FreeTextPracticeCycleStatus',
  { values: Object.values(DB.FreeTextPracticeCycleStatus) }
)

export const FreeTextEvaluationStatus = builder.enumType(
  'FreeTextEvaluationStatus',
  { values: Object.values(DB.FreeTextEvaluationStatus) }
)

export const FreeTextEvaluationSource = builder.enumType(
  'FreeTextEvaluationSource',
  { values: Object.values(DB.FreeTextEvaluationSource) }
)

export const FreeTextCorrectnessCategory = builder.enumType(
  'FreeTextCorrectnessCategory',
  { values: Object.values(DB.FreeTextCorrectnessCategory) }
)

export const SemanticFreeTextCapabilityAvailability = builder.enumType(
  'SemanticFreeTextCapabilityAvailability',
  { values: ['AVAILABLE', 'DEGRADED', 'UNAVAILABLE'] as const }
)

export const SemanticEvaluationConsentDecision = builder.enumType(
  'SemanticEvaluationConsentDecision',
  { values: Object.values(DB.SemanticEvaluationConsentDecision) }
)

const FreeTextRubricFeedbackType = builder
  .objectRef<FreeTextRubricFeedback>('FreeTextRubricFeedback')
  .implement({
    fields: (t) => ({
      rubricId: t.exposeString('rubricId'),
      rubricName: t.exposeString('rubricName'),
      proposedLevel: t.exposeString('proposedLevel'),
      normalizedScore: t.exposeFloat('normalizedScore'),
      criterionStatus: t.expose('criterionStatus', {
        type: FreeTextCorrectnessCategory,
      }),
      rationale: t.exposeString('rationale'),
    }),
  })

const FreeTextFeedbackType = builder
  .objectRef<FreeTextFeedback>('FreeTextFeedback')
  .implement({
    fields: (t) => ({
      rubricId: t.exposeString('rubricId'),
      rubricName: t.exposeString('rubricName'),
      feedback: t.exposeString('feedback'),
    }),
  })

const FreeTextEvaluationFeedbackType = builder
  .objectRef<FreeTextEvaluationFeedback>('FreeTextEvaluationFeedback')
  .implement({
    fields: (t) => ({
      rubricAssessments: t.expose('rubricAssessments', {
        type: [FreeTextRubricFeedbackType],
      }),
      feedbackProposals: t.expose('feedbackProposals', {
        type: [FreeTextFeedbackType],
      }),
    }),
  })

export const FreeTextAttemptStateRef = builder.objectRef<FreeTextAttemptState>(
  'FreeTextAttemptState'
)
export const FreeTextAttemptStateType = FreeTextAttemptStateRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    ordinal: t.exposeInt('ordinal'),
    answer: t.exposeString('answer'),
    evaluationRevision: t.exposeInt('evaluationRevision'),
    evaluationStatus: t.expose('evaluationStatus', {
      type: FreeTextEvaluationStatus,
    }),
    evaluationSource: t.expose('evaluationSource', {
      type: FreeTextEvaluationSource,
      nullable: true,
    }),
    retryable: t.exposeBoolean('retryable'),
    availabilityReason: t.exposeString('availabilityReason', {
      nullable: true,
    }),
    aggregateScore: t.exposeFloat('aggregateScore', { nullable: true }),
    outcomeBandId: t.exposeString('outcomeBandId', { nullable: true }),
    outcomeBandLabel: t.exposeString('outcomeBandLabel', { nullable: true }),
    correctness: t.expose('correctness', {
      type: FreeTextCorrectnessCategory,
      nullable: true,
    }),
    evaluatorVersion: t.exposeString('evaluatorVersion', { nullable: true }),
    modelVersion: t.exposeString('modelVersion', { nullable: true }),
    structuredResult: t.expose('structuredResult', {
      type: FreeTextEvaluationFeedbackType,
      nullable: true,
    }),
    pointsAwarded: t.exposeFloat('pointsAwarded', { nullable: true }),
    xpAwarded: t.exposeFloat('xpAwarded'),
    createdAt: t.expose('createdAt', { type: DateScalar }),
    completedAt: t.expose('completedAt', {
      type: DateScalar,
      nullable: true,
    }),
  }),
})

export const FreeTextPracticeStateRef =
  builder.objectRef<FreeTextPracticeState>('FreeTextPracticeState')
const FreeTextPeerAnswer = builder
  .objectRef<{ value: string; count: number }>('FreeTextPeerAnswer')
  .implement({
    fields: (t) => ({
      value: t.exposeString('value'),
      count: t.exposeInt('count'),
    }),
  })
export const FreeTextPracticeStateType = FreeTextPracticeStateRef.implement({
  fields: (t) => ({
    instanceId: t.exposeInt('instanceId'),
    cycleId: t.exposeString('cycleId'),
    cycleOrdinal: t.exposeInt('cycleOrdinal'),
    cycleStatus: t.expose('cycleStatus', {
      type: FreeTextPracticeCycleStatus,
    }),
    stateVersion: t.exposeInt('stateVersion'),
    attemptLimit: t.exposeInt('attemptLimit'),
    attemptsUsed: t.exposeInt('attemptsUsed'),
    attemptsRemaining: t.exposeInt('attemptsRemaining'),
    attempts: t.expose('attempts', { type: [FreeTextAttemptStateType] }),
    currentAttempt: t.expose('currentAttempt', {
      type: FreeTextAttemptStateType,
      nullable: true,
    }),
    canSubmitAnswer: t.exposeBoolean('canSubmitAnswer'),
    canRetryEvaluation: t.exposeBoolean('canRetryEvaluation'),
    canRevealSolution: t.exposeBoolean('canRevealSolution'),
    canPracticeAgain: t.exposeBoolean('canPracticeAgain'),
    solutionAuthorized: t.exposeBoolean('solutionAuthorized'),
    referenceSolution: t.exposeString('referenceSolution', { nullable: true }),
    explanation: t.exposeString('explanation', { nullable: true }),
    peerAnswers: t.expose('peerAnswers', { type: [FreeTextPeerAnswer] }),
  }),
})

export const SemanticFreeTextCapabilityRef =
  builder.objectRef<SemanticFreeTextCapabilityData>(
    'SemanticFreeTextCapability'
  )
export const SemanticFreeTextCapability =
  SemanticFreeTextCapabilityRef.implement({
    fields: (t) => ({
      entitled: t.exposeBoolean('entitled'),
      availability: t.expose('availability', {
        type: SemanticFreeTextCapabilityAvailability,
      }),
      reason: t.exposeString('reason', { nullable: true }),
      retryable: t.exposeBoolean('retryable'),
      disclosureVersion: t.exposeString('disclosureVersion'),
      provider: t.exposeString('provider'),
      consentDecision: t.expose('consentDecision', {
        type: SemanticEvaluationConsentDecision,
        nullable: true,
      }),
    }),
  })
