import { z } from 'zod'
import {
  type AccessChangePayload,
  type AssessmentModeChangedPayload,
  accessChangePayloadSchema,
  assessmentModeChangedPayloadSchema,
  blockStateSchema,
  type ConfigurationChangePayload,
  type CourseAssignmentChangedPayload,
  configurationChangePayloadSchema,
  courseAssignmentChangedPayloadSchema,
  type LifecycleTransitionPayload,
  lifecycleTransitionPayloadSchema,
  type RejectedActionPayload,
  rejectedActionPayloadSchema,
  type SessionPayload,
  sessionPayloadSchema,
} from './payloads/assessment.js'
import {
  type AuditActivatedPayload,
  auditActivatedPayloadSchema,
  type BaselinePartPayload,
  type BaselineRootPayload,
  baselinePartPayloadSchema,
  baselineRootPayloadSchema,
  type RolloutBaselinePayload,
  rolloutBaselinePayloadSchema,
} from './payloads/coverage.js'
import {
  type AuditOperationPayload,
  auditOperationPayloadSchema,
  type BulkOperationPayload,
  bulkOperationPayloadSchema,
  type ClientOperationPayload,
  clientOperationPayloadSchema,
  type EvidenceAdministrationPayload,
  evidenceAdministrationPayloadSchema,
  type ReportPayload,
  reportPayloadSchema,
} from './payloads/operations.js'
import {
  type AnswerChangePayload,
  answerChangePayloadSchema,
  type ResponseChangePayload,
  responseChangePayloadSchema,
  type SubmissionAttemptPayload,
  type SubmissionOutcomePayload,
  submissionAttemptPayloadSchema,
  submissionOutcomePayloadSchema,
} from './payloads/submission.js'

export const DELIVERY_TIERS = ['LAUNCH', 'FAST_FOLLOW', 'STACK_2'] as const
export type DeliveryTier = (typeof DELIVERY_TIERS)[number]

export const EMISSION_PATHS = [
  'LANE_1_OUTBOX',
  'LANE_2_HATCHET',
  'CLIENT_INGRESS',
  'OWNER_CLI',
] as const
export type EmissionPath = (typeof EMISSION_PATHS)[number]

export const EVIDENCE_CLASSES = [
  'AUTHORITATIVE',
  'SERVER_OBSERVED',
  'CLIENT_OBSERVED',
  'ADMINISTRATIVE',
] as const
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number]

export const CRITICALITIES = ['CRITICAL', 'STANDARD'] as const
export type AuditCriticality = (typeof CRITICALITIES)[number]

export const RECORDED_VIA_VALUES = [
  'TRANSACTIONAL_OUTBOX',
  'CLIENT_QUEUE_DRAINER',
  'HATCHET_PROCESSOR',
  'OWNER_CLI',
  'AUDIT_SERVICE',
] as const
export type RecordedVia = (typeof RECORDED_VIA_VALUES)[number]

type FamilyDefinition = {
  events: readonly string[]
  tier: DeliveryTier
  emissionPath: EmissionPath
  evidenceClass: EvidenceClass
  criticality: AuditCriticality
  allowedRecordedVia: readonly RecordedVia[]
  ownerPackage: string
  producer: string
  durabilityPoint: string
}

const EVENT_FAMILIES = [
  {
    events: [
      'ASSESSMENT_AUDIT_ACTIVATED',
      'ASSESSMENT_ROLLOUT_BASELINE_RECORDED',
      'ASSESSMENT_BASELINE_ROOT_RECORDED',
      'ASSESSMENT_BASELINE_PART_RECORDED',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'AUTHORITATIVE',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'assessment audit activation and baseline service',
    durabilityPoint: 'coverage/baseline transaction commit',
  },
  {
    events: [
      'ASSESSMENT_MODE_CHANGED',
      'ASSESSMENT_COURSE_ASSIGNMENT_CHANGED',
      'ASSESSMENT_PUBLISHED',
      'ASSESSMENT_STARTED',
      'ASSESSMENT_PAUSED',
      'ASSESSMENT_RESUMED',
      'ASSESSMENT_COMPLETED',
      'ASSESSMENT_REOPENED',
      'ASSESSMENT_CANCELLED',
      'ASSESSMENT_RESET',
      'ASSESSMENT_COPIED',
      'ASSESSMENT_IMPORTED',
      'ASSESSMENT_DELETED',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'AUTHORITATIVE',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'LiveQuiz lifecycle services and scheduled workers',
    durabilityPoint: 'lifecycle transaction commit',
  },
  {
    events: [
      'ASSESSMENT_CONFIGURATION_CHANGED',
      'ASSESSMENT_BLOCK_CREATED',
      'ASSESSMENT_BLOCK_UPDATED',
      'ASSESSMENT_BLOCK_REORDERED',
      'ASSESSMENT_BLOCK_ACTIVATED',
      'ASSESSMENT_BLOCK_CLOSED',
      'ASSESSMENT_BLOCK_DELETED',
      'ASSESSMENT_ELEMENT_INSTANCE_ADDED',
      'ASSESSMENT_ELEMENT_INSTANCE_REFRESHED',
      'ASSESSMENT_ELEMENT_INSTANCE_UPDATED',
      'ASSESSMENT_ELEMENT_INSTANCE_REORDERED',
      'ASSESSMENT_ELEMENT_INSTANCE_REMOVED',
      'ASSESSMENT_SOURCE_ELEMENT_CHANGED',
      'ASSESSMENT_MEDIA_CAPTURED',
      'ASSESSMENT_MEDIA_REPLACED',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'AUTHORITATIVE',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'LiveQuiz content and configuration services',
    durabilityPoint: 'content/configuration transaction commit',
  },
  {
    events: [
      'ASSESSMENT_SESSION_STARTED',
      'ASSESSMENT_SESSION_RESUMED',
      'ASSESSMENT_SESSION_ENDED',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'SERVER_OBSERVED',
    criticality: 'STANDARD',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'LiveQuiz runtime session transitions',
    durabilityPoint: 'runtime transition transaction commit',
  },
  {
    events: [
      'ASSESSMENT_PARTICIPANT_ELIGIBILITY_CHANGED',
      'ASSESSMENT_LECTURER_PERMISSION_CHANGED',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'AUTHORITATIVE',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'assessment eligibility and permission services',
    durabilityPoint: 'eligibility/permission transaction commit',
  },
  {
    events: ['ASSESSMENT_ACTION_REJECTED'],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'SERVER_OBSERVED',
    criticality: 'STANDARD',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'authenticated assessment endpoints and workers',
    durabilityPoint: 'standalone audit transaction commit',
  },
  {
    events: ['RESPONSE_ANSWER_CHANGED', 'RESPONSE_ANSWER_CLEARED'],
    tier: 'STACK_2',
    emissionPath: 'CLIENT_INGRESS',
    evidenceClass: 'CLIENT_OBSERVED',
    criticality: 'STANDARD',
    allowedRecordedVia: ['CLIENT_QUEUE_DRAINER'],
    ownerPackage: '@klicker-uzh/audit-ingress',
    producer: 'PWA client outbox through independent ingress',
    durabilityPoint: 'Azure Queue insertion before client acknowledgement',
  },
  {
    events: ['SUBMISSION_ATTEMPTED', 'SUBMISSION_AUTO_TRIGGERED'],
    tier: 'STACK_2',
    emissionPath: 'CLIENT_INGRESS',
    evidenceClass: 'CLIENT_OBSERVED',
    criticality: 'STANDARD',
    allowedRecordedVia: ['CLIENT_QUEUE_DRAINER'],
    ownerPackage: '@klicker-uzh/audit-ingress',
    producer: 'PWA client outbox through independent ingress',
    durabilityPoint: 'Azure Queue insertion before client acknowledgement',
  },
  {
    events: [
      'SUBMISSION_SERVER_ACCEPTED',
      'SUBMISSION_VALIDATED',
      'SUBMISSION_REJECTED',
      'SUBMISSION_DUPLICATE',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_2_HATCHET',
    evidenceClass: 'SERVER_OBSERVED',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['HATCHET_PROCESSOR'],
    ownerPackage: '@klicker-uzh/hatchet-worker-response-processor',
    producer: 'assessment response processor',
    durabilityPoint: 'processor audit transaction before task completion',
  },
  {
    events: ['SUBMISSION_PERSISTED', 'SUBMISSION_SCORED'],
    tier: 'LAUNCH',
    emissionPath: 'LANE_2_HATCHET',
    evidenceClass: 'AUTHORITATIVE',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['HATCHET_PROCESSOR'],
    ownerPackage: '@klicker-uzh/hatchet-worker-response-processor',
    producer: 'assessment response processor',
    durabilityPoint: 'response/scoring transaction commit',
  },
  {
    events: ['SUBMISSION_PROCESSING_FAILED', 'SUBMISSION_PROCESSING_RECOVERED'],
    tier: 'LAUNCH',
    emissionPath: 'LANE_2_HATCHET',
    evidenceClass: 'SERVER_OBSERVED',
    criticality: 'STANDARD',
    allowedRecordedVia: ['HATCHET_PROCESSOR'],
    ownerPackage: '@klicker-uzh/hatchet-worker-response-processor',
    producer: 'assessment response processor',
    durabilityPoint: 'processor audit transaction before task completion',
  },
  {
    events: ['ASSESSMENT_POINTS_CORRECTED', 'ASSESSMENT_PARTICIPANT_RESET'],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'AUTHORITATIVE',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'response and scoring administration services',
    durabilityPoint: 'response/scoring transaction commit',
  },
  {
    events: [
      'ASSESSMENT_BULK_OPERATION_STARTED',
      'ASSESSMENT_BULK_ITEM_COMPLETED',
      'ASSESSMENT_BULK_OPERATION_COMPLETED',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'AUTHORITATIVE',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'assessment bulk services and workers',
    durabilityPoint: 'per-effect transaction commit',
  },
  {
    events: [
      'ASSESSMENT_REPORT_ISSUED',
      'ASSESSMENT_REPORT_SUPERSEDED',
      'ASSESSMENT_REPORT_REVOKED',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'AUTHORITATIVE',
    criticality: 'CRITICAL',
    allowedRecordedVia: ['TRANSACTIONAL_OUTBOX'],
    ownerPackage: '@klicker-uzh/graphql',
    producer: 'assessment report service',
    durabilityPoint: 'report transaction commit',
  },
  {
    events: [
      'EVIDENCE_ANNOTATION',
      'EVIDENCE_HOLD_PLACED',
      'EVIDENCE_HOLD_RELEASED',
    ],
    tier: 'FAST_FOLLOW',
    emissionPath: 'OWNER_CLI',
    evidenceClass: 'ADMINISTRATIVE',
    criticality: 'STANDARD',
    allowedRecordedVia: ['OWNER_CLI'],
    ownerPackage: '@klicker-uzh/audit',
    producer: 'evidence owner CLI',
    durabilityPoint: 'direct append-only Azure control-table creation',
  },
  {
    events: [
      'AUDIT_GAP_DETECTED',
      'AUDIT_GAP_RESOLVED',
      'AUDIT_CLIENT_EVENT_REJECTED',
    ],
    tier: 'STACK_2',
    emissionPath: 'CLIENT_INGRESS',
    evidenceClass: 'SERVER_OBSERVED',
    criticality: 'STANDARD',
    allowedRecordedVia: ['CLIENT_QUEUE_DRAINER'],
    ownerPackage: '@klicker-uzh/audit-ingress',
    producer: 'independent ingress and client queue drainer',
    durabilityPoint: 'queue-drainer append transaction',
  },
  {
    events: [
      'AUDIT_DELIVERY_DELAYED',
      'AUDIT_DELIVERY_CONFLICTED',
      'AUDIT_DELIVERY_QUARANTINED',
      'AUDIT_DELIVERY_RECOVERED',
    ],
    tier: 'LAUNCH',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'SERVER_OBSERVED',
    criticality: 'STANDARD',
    allowedRecordedVia: ['AUDIT_SERVICE'],
    ownerPackage: '@klicker-uzh/audit',
    producer: 'audit dispatcher and monitor',
    durabilityPoint: 'standalone audit transaction commit',
  },
  {
    events: [
      'AUDIT_MANIFEST_SEALED',
      'AUDIT_MANIFEST_FAILED',
      'AUDIT_RETENTION_COMPLETED',
      'AUDIT_RETENTION_FAILED',
    ],
    tier: 'FAST_FOLLOW',
    emissionPath: 'LANE_1_OUTBOX',
    evidenceClass: 'SERVER_OBSERVED',
    criticality: 'STANDARD',
    allowedRecordedVia: ['AUDIT_SERVICE'],
    ownerPackage: '@klicker-uzh/audit',
    producer: 'manifest sealer and retention worker',
    durabilityPoint: 'standalone audit transaction commit',
  },
] as const satisfies readonly FamilyDefinition[]

export type EventType = (typeof EVENT_FAMILIES)[number]['events'][number]

type LifecycleEvent =
  | 'ASSESSMENT_PUBLISHED'
  | 'ASSESSMENT_STARTED'
  | 'ASSESSMENT_PAUSED'
  | 'ASSESSMENT_RESUMED'
  | 'ASSESSMENT_COMPLETED'
  | 'ASSESSMENT_REOPENED'
  | 'ASSESSMENT_CANCELLED'
  | 'ASSESSMENT_RESET'
  | 'ASSESSMENT_COPIED'
  | 'ASSESSMENT_IMPORTED'
  | 'ASSESSMENT_DELETED'

type ConfigurationEvent =
  | 'ASSESSMENT_CONFIGURATION_CHANGED'
  | 'ASSESSMENT_BLOCK_CREATED'
  | 'ASSESSMENT_BLOCK_UPDATED'
  | 'ASSESSMENT_BLOCK_REORDERED'
  | 'ASSESSMENT_BLOCK_ACTIVATED'
  | 'ASSESSMENT_BLOCK_CLOSED'
  | 'ASSESSMENT_BLOCK_DELETED'
  | 'ASSESSMENT_ELEMENT_INSTANCE_ADDED'
  | 'ASSESSMENT_ELEMENT_INSTANCE_REFRESHED'
  | 'ASSESSMENT_ELEMENT_INSTANCE_UPDATED'
  | 'ASSESSMENT_ELEMENT_INSTANCE_REORDERED'
  | 'ASSESSMENT_ELEMENT_INSTANCE_REMOVED'
  | 'ASSESSMENT_SOURCE_ELEMENT_CHANGED'
  | 'ASSESSMENT_MEDIA_CAPTURED'
  | 'ASSESSMENT_MEDIA_REPLACED'

type SessionEvent =
  | 'ASSESSMENT_SESSION_STARTED'
  | 'ASSESSMENT_SESSION_RESUMED'
  | 'ASSESSMENT_SESSION_ENDED'

type SubmissionOutcomeEvent =
  | 'SUBMISSION_SERVER_ACCEPTED'
  | 'SUBMISSION_VALIDATED'
  | 'SUBMISSION_REJECTED'
  | 'SUBMISSION_DUPLICATE'
  | 'SUBMISSION_PERSISTED'
  | 'SUBMISSION_SCORED'
  | 'SUBMISSION_PROCESSING_FAILED'
  | 'SUBMISSION_PROCESSING_RECOVERED'

type ResponseChangeEvent =
  | 'ASSESSMENT_POINTS_CORRECTED'
  | 'ASSESSMENT_PARTICIPANT_RESET'

type BulkEvent =
  | 'ASSESSMENT_BULK_OPERATION_STARTED'
  | 'ASSESSMENT_BULK_ITEM_COMPLETED'
  | 'ASSESSMENT_BULK_OPERATION_COMPLETED'

type AuditOperationEvent =
  | 'AUDIT_DELIVERY_DELAYED'
  | 'AUDIT_DELIVERY_CONFLICTED'
  | 'AUDIT_DELIVERY_QUARANTINED'
  | 'AUDIT_DELIVERY_RECOVERED'
  | 'AUDIT_MANIFEST_SEALED'
  | 'AUDIT_MANIFEST_FAILED'
  | 'AUDIT_RETENTION_COMPLETED'
  | 'AUDIT_RETENTION_FAILED'

export type EventPayload<T extends EventType> =
  T extends 'ASSESSMENT_AUDIT_ACTIVATED'
    ? AuditActivatedPayload
    : T extends 'ASSESSMENT_ROLLOUT_BASELINE_RECORDED'
      ? RolloutBaselinePayload
      : T extends 'ASSESSMENT_BASELINE_ROOT_RECORDED'
        ? BaselineRootPayload
        : T extends 'ASSESSMENT_BASELINE_PART_RECORDED'
          ? BaselinePartPayload
          : T extends 'ASSESSMENT_MODE_CHANGED'
            ? AssessmentModeChangedPayload
            : T extends 'ASSESSMENT_COURSE_ASSIGNMENT_CHANGED'
              ? CourseAssignmentChangedPayload
              : T extends LifecycleEvent
                ? LifecycleTransitionPayload
                : T extends ConfigurationEvent
                  ? ConfigurationChangePayload
                  : T extends
                        | 'ASSESSMENT_PARTICIPANT_ELIGIBILITY_CHANGED'
                        | 'ASSESSMENT_LECTURER_PERMISSION_CHANGED'
                    ? AccessChangePayload
                    : T extends SessionEvent
                      ? SessionPayload
                      : T extends 'ASSESSMENT_ACTION_REJECTED'
                        ? RejectedActionPayload
                        : T extends
                              | 'RESPONSE_ANSWER_CHANGED'
                              | 'RESPONSE_ANSWER_CLEARED'
                          ? AnswerChangePayload
                          : T extends
                                | 'SUBMISSION_ATTEMPTED'
                                | 'SUBMISSION_AUTO_TRIGGERED'
                            ? SubmissionAttemptPayload
                            : T extends SubmissionOutcomeEvent
                              ? SubmissionOutcomePayload
                              : T extends ResponseChangeEvent
                                ? ResponseChangePayload
                                : T extends BulkEvent
                                  ? BulkOperationPayload
                                  : T extends
                                        | 'ASSESSMENT_REPORT_ISSUED'
                                        | 'ASSESSMENT_REPORT_SUPERSEDED'
                                        | 'ASSESSMENT_REPORT_REVOKED'
                                    ? ReportPayload
                                    : T extends
                                          | 'EVIDENCE_ANNOTATION'
                                          | 'EVIDENCE_HOLD_PLACED'
                                          | 'EVIDENCE_HOLD_RELEASED'
                                      ? EvidenceAdministrationPayload
                                      : T extends
                                            | 'AUDIT_GAP_DETECTED'
                                            | 'AUDIT_GAP_RESOLVED'
                                            | 'AUDIT_CLIENT_EVENT_REJECTED'
                                        ? ClientOperationPayload
                                        : T extends AuditOperationEvent
                                          ? AuditOperationPayload
                                          : never

const copiedLifecycleSchema = lifecycleTransitionPayloadSchema('DRAFT').refine(
  (value) => value.sourceLiveQuizId !== undefined,
  { message: 'copied/imported assessment evidence requires sourceLiveQuizId' }
)

const bulkItemCompletedPayloadSchema = z.union([
  bulkOperationPayloadSchema('SUCCEEDED'),
  bulkOperationPayloadSchema('FAILED'),
])

const blockActivatedPayloadSchema = configurationChangePayloadSchema(
  'BLOCK',
  'UPDATED',
  ['status', 'startedAt', 'expiresAt', 'execution']
).refine(
  (value) => {
    const after = blockStateSchema.safeParse(value.after)
    return after.success && after.data.status === 'ACTIVE'
  },
  { message: 'block activation requires ACTIVE after-state' }
)

const blockClosedPayloadSchema = configurationChangePayloadSchema(
  'BLOCK',
  'UPDATED',
  ['status', 'closedAt']
).refine(
  (value) => {
    const after = blockStateSchema.safeParse(value.after)
    return (
      after.success &&
      after.data.status === 'EXECUTED' &&
      after.data.closedAt !== null
    )
  },
  { message: 'block closure requires EXECUTED state and closedAt' }
)

const EVENT_PAYLOAD_SCHEMAS: Record<EventType, z.ZodTypeAny> = {
  ASSESSMENT_AUDIT_ACTIVATED: auditActivatedPayloadSchema,
  ASSESSMENT_ROLLOUT_BASELINE_RECORDED: rolloutBaselinePayloadSchema,
  ASSESSMENT_BASELINE_ROOT_RECORDED: baselineRootPayloadSchema,
  ASSESSMENT_BASELINE_PART_RECORDED: baselinePartPayloadSchema,
  ASSESSMENT_MODE_CHANGED: assessmentModeChangedPayloadSchema,
  ASSESSMENT_COURSE_ASSIGNMENT_CHANGED: courseAssignmentChangedPayloadSchema,
  ASSESSMENT_PUBLISHED: lifecycleTransitionPayloadSchema('PUBLISHED'),
  ASSESSMENT_STARTED: lifecycleTransitionPayloadSchema('RUNNING'),
  ASSESSMENT_PAUSED: lifecycleTransitionPayloadSchema('PAUSED'),
  ASSESSMENT_RESUMED: lifecycleTransitionPayloadSchema('RUNNING'),
  ASSESSMENT_COMPLETED: lifecycleTransitionPayloadSchema('COMPLETED'),
  ASSESSMENT_REOPENED: lifecycleTransitionPayloadSchema('DRAFT'),
  ASSESSMENT_CANCELLED: lifecycleTransitionPayloadSchema('CANCELLED'),
  ASSESSMENT_RESET: lifecycleTransitionPayloadSchema('DRAFT'),
  ASSESSMENT_COPIED: copiedLifecycleSchema,
  ASSESSMENT_IMPORTED: copiedLifecycleSchema,
  ASSESSMENT_DELETED: lifecycleTransitionPayloadSchema('DELETED'),
  ASSESSMENT_CONFIGURATION_CHANGED: configurationChangePayloadSchema(
    'ASSESSMENT',
    'UPDATED'
  ),
  ASSESSMENT_BLOCK_CREATED: configurationChangePayloadSchema(
    'BLOCK',
    'CREATED'
  ),
  ASSESSMENT_BLOCK_UPDATED: configurationChangePayloadSchema(
    'BLOCK',
    'UPDATED',
    ['timeLimitSeconds', 'expiresAt', 'randomSelectionCount']
  ),
  ASSESSMENT_BLOCK_REORDERED: configurationChangePayloadSchema(
    'BLOCK',
    'UPDATED',
    ['order']
  ),
  ASSESSMENT_BLOCK_ACTIVATED: blockActivatedPayloadSchema,
  ASSESSMENT_BLOCK_CLOSED: blockClosedPayloadSchema,
  ASSESSMENT_BLOCK_DELETED: configurationChangePayloadSchema(
    'BLOCK',
    'DELETED'
  ),
  ASSESSMENT_ELEMENT_INSTANCE_ADDED: configurationChangePayloadSchema(
    'ELEMENT_INSTANCE',
    'CREATED'
  ),
  ASSESSMENT_ELEMENT_INSTANCE_REFRESHED: configurationChangePayloadSchema(
    'ELEMENT_INSTANCE',
    'UPDATED',
    [
      'sourceElementVersion',
      'isVersionOutdated',
      'effectiveElement',
      'effectiveContentHash',
      'effectiveSolutionHash',
    ]
  ),
  ASSESSMENT_ELEMENT_INSTANCE_UPDATED: configurationChangePayloadSchema(
    'ELEMENT_INSTANCE',
    'UPDATED'
  ),
  ASSESSMENT_ELEMENT_INSTANCE_REORDERED: configurationChangePayloadSchema(
    'ELEMENT_INSTANCE',
    'UPDATED',
    ['order', 'blockId']
  ),
  ASSESSMENT_ELEMENT_INSTANCE_REMOVED: configurationChangePayloadSchema(
    'ELEMENT_INSTANCE',
    'DELETED'
  ),
  ASSESSMENT_SOURCE_ELEMENT_CHANGED: configurationChangePayloadSchema(
    'SOURCE_ELEMENT',
    'UPDATED'
  ),
  ASSESSMENT_MEDIA_CAPTURED: configurationChangePayloadSchema(
    'MEDIA',
    'CREATED'
  ),
  ASSESSMENT_MEDIA_REPLACED: configurationChangePayloadSchema(
    'MEDIA',
    'UPDATED'
  ),
  ASSESSMENT_PARTICIPANT_ELIGIBILITY_CHANGED:
    accessChangePayloadSchema('PARTICIPANT'),
  ASSESSMENT_LECTURER_PERMISSION_CHANGED: accessChangePayloadSchema('USER'),
  ASSESSMENT_SESSION_STARTED: sessionPayloadSchema('STARTED'),
  ASSESSMENT_SESSION_RESUMED: sessionPayloadSchema('RESUMED'),
  ASSESSMENT_SESSION_ENDED: sessionPayloadSchema('ENDED'),
  ASSESSMENT_ACTION_REJECTED: rejectedActionPayloadSchema,
  RESPONSE_ANSWER_CHANGED: answerChangePayloadSchema(false),
  RESPONSE_ANSWER_CLEARED: answerChangePayloadSchema(true),
  SUBMISSION_ATTEMPTED: submissionAttemptPayloadSchema('CLICK'),
  SUBMISSION_AUTO_TRIGGERED: submissionAttemptPayloadSchema('AUTO'),
  SUBMISSION_SERVER_ACCEPTED: submissionOutcomePayloadSchema('SERVER_ACCEPTED'),
  SUBMISSION_VALIDATED: submissionOutcomePayloadSchema('VALIDATED'),
  SUBMISSION_REJECTED: submissionOutcomePayloadSchema('REJECTED'),
  SUBMISSION_DUPLICATE: submissionOutcomePayloadSchema('DUPLICATE'),
  SUBMISSION_PERSISTED: submissionOutcomePayloadSchema('PERSISTED'),
  SUBMISSION_SCORED: submissionOutcomePayloadSchema('SCORED'),
  SUBMISSION_PROCESSING_FAILED:
    submissionOutcomePayloadSchema('PROCESSING_FAILED'),
  SUBMISSION_PROCESSING_RECOVERED: submissionOutcomePayloadSchema(
    'PROCESSING_RECOVERED'
  ),
  ASSESSMENT_POINTS_CORRECTED: responseChangePayloadSchema('CORRECTED'),
  ASSESSMENT_PARTICIPANT_RESET: responseChangePayloadSchema('RESET'),
  ASSESSMENT_BULK_OPERATION_STARTED: bulkOperationPayloadSchema('STARTED'),
  ASSESSMENT_BULK_ITEM_COMPLETED: bulkItemCompletedPayloadSchema,
  ASSESSMENT_BULK_OPERATION_COMPLETED: bulkOperationPayloadSchema('COMPLETED'),
  ASSESSMENT_REPORT_ISSUED: reportPayloadSchema,
  ASSESSMENT_REPORT_SUPERSEDED: reportPayloadSchema.refine(
    (value) => value.previousReportId !== undefined,
    { message: 'superseded reports require previousReportId' }
  ),
  ASSESSMENT_REPORT_REVOKED: reportPayloadSchema.refine(
    (value) => value.reasonCode !== undefined,
    { message: 'revoked reports require reasonCode' }
  ),
  EVIDENCE_ANNOTATION: evidenceAdministrationPayloadSchema.refine(
    (value) => value.annotation !== undefined,
    { message: 'evidence annotations require annotation text' }
  ),
  EVIDENCE_HOLD_PLACED: evidenceAdministrationPayloadSchema,
  EVIDENCE_HOLD_RELEASED: evidenceAdministrationPayloadSchema,
  AUDIT_GAP_DETECTED: clientOperationPayloadSchema,
  AUDIT_GAP_RESOLVED: clientOperationPayloadSchema,
  AUDIT_CLIENT_EVENT_REJECTED: clientOperationPayloadSchema,
  AUDIT_DELIVERY_DELAYED: auditOperationPayloadSchema('AUDIT_DELIVERY_DELAYED'),
  AUDIT_DELIVERY_CONFLICTED: auditOperationPayloadSchema(
    'AUDIT_DELIVERY_CONFLICTED'
  ),
  AUDIT_DELIVERY_QUARANTINED: auditOperationPayloadSchema(
    'AUDIT_DELIVERY_QUARANTINED'
  ),
  AUDIT_DELIVERY_RECOVERED: auditOperationPayloadSchema(
    'AUDIT_DELIVERY_RECOVERED'
  ),
  AUDIT_MANIFEST_SEALED: auditOperationPayloadSchema('AUDIT_MANIFEST_SEALED'),
  AUDIT_MANIFEST_FAILED: auditOperationPayloadSchema('AUDIT_MANIFEST_FAILED'),
  AUDIT_RETENTION_COMPLETED: auditOperationPayloadSchema(
    'AUDIT_RETENTION_COMPLETED'
  ),
  AUDIT_RETENTION_FAILED: auditOperationPayloadSchema('AUDIT_RETENTION_FAILED'),
}

export type EventRegistration = Omit<FamilyDefinition, 'events'> & {
  payloadSchemaVersion: 1
  payloadSchemas: Readonly<Partial<Record<number, z.ZodTypeAny>>>
  requiresParticipantScope: boolean
  requiresSubmissionId: boolean
  requiresHatchetEventId: boolean
  requiresClientProvenance: boolean
}

const participantScopedEvents = new Set<EventType>([
  'ASSESSMENT_PARTICIPANT_ELIGIBILITY_CHANGED',
  'RESPONSE_ANSWER_CHANGED',
  'RESPONSE_ANSWER_CLEARED',
  'SUBMISSION_ATTEMPTED',
  'SUBMISSION_AUTO_TRIGGERED',
  'SUBMISSION_SERVER_ACCEPTED',
  'SUBMISSION_VALIDATED',
  'SUBMISSION_REJECTED',
  'SUBMISSION_DUPLICATE',
  'SUBMISSION_PERSISTED',
  'SUBMISSION_SCORED',
  'SUBMISSION_PROCESSING_FAILED',
  'SUBMISSION_PROCESSING_RECOVERED',
  'ASSESSMENT_POINTS_CORRECTED',
  'ASSESSMENT_PARTICIPANT_RESET',
  'AUDIT_GAP_DETECTED',
  'AUDIT_GAP_RESOLVED',
  'AUDIT_CLIENT_EVENT_REJECTED',
])

const submissionEvents = new Set<EventType>([
  'SUBMISSION_ATTEMPTED',
  'SUBMISSION_AUTO_TRIGGERED',
  'SUBMISSION_SERVER_ACCEPTED',
  'SUBMISSION_VALIDATED',
  'SUBMISSION_REJECTED',
  'SUBMISSION_DUPLICATE',
  'SUBMISSION_PERSISTED',
  'SUBMISSION_SCORED',
  'SUBMISSION_PROCESSING_FAILED',
  'SUBMISSION_PROCESSING_RECOVERED',
])

const hatchetEvents = new Set<EventType>([
  'SUBMISSION_SERVER_ACCEPTED',
  'SUBMISSION_VALIDATED',
  'SUBMISSION_REJECTED',
  'SUBMISSION_DUPLICATE',
  'SUBMISSION_PERSISTED',
  'SUBMISSION_SCORED',
  'SUBMISSION_PROCESSING_FAILED',
  'SUBMISSION_PROCESSING_RECOVERED',
])

const clientProvenanceEvents = new Set<EventType>([
  'RESPONSE_ANSWER_CHANGED',
  'RESPONSE_ANSWER_CLEARED',
  'SUBMISSION_ATTEMPTED',
  'SUBMISSION_AUTO_TRIGGERED',
  'AUDIT_GAP_DETECTED',
  'AUDIT_GAP_RESOLVED',
  'AUDIT_CLIENT_EVENT_REJECTED',
])

const registrations: Partial<Record<EventType, EventRegistration>> = {}
const stableEventTypes: EventType[] = []

for (const family of EVENT_FAMILIES) {
  for (const eventType of family.events) {
    if (registrations[eventType] !== undefined) {
      throw new Error(`Duplicate audit event registration: ${eventType}`)
    }

    const { events: _events, ...metadata } = family
    registrations[eventType] = Object.freeze({
      ...metadata,
      payloadSchemaVersion: 1,
      payloadSchemas: Object.freeze({
        1: EVENT_PAYLOAD_SCHEMAS[eventType],
      }),
      requiresParticipantScope: participantScopedEvents.has(eventType),
      requiresSubmissionId: submissionEvents.has(eventType),
      requiresHatchetEventId: hatchetEvents.has(eventType),
      requiresClientProvenance: clientProvenanceEvents.has(eventType),
    })
    stableEventTypes.push(eventType)
  }
}

export const STABLE_EVENT_TYPES = Object.freeze(stableEventTypes)
export const EVENT_REGISTRY = Object.freeze(registrations) as Readonly<
  Record<EventType, EventRegistration>
>

export function getEventRegistration(eventType: string): EventRegistration {
  if (!Object.hasOwn(EVENT_REGISTRY, eventType)) {
    throw new Error(`Unknown audit event type: ${eventType}`)
  }
  return EVENT_REGISTRY[eventType as EventType]
}

export function getEventPayloadSchema(
  eventType: EventType,
  payloadSchemaVersion: number
): z.ZodTypeAny {
  const schema = EVENT_REGISTRY[eventType].payloadSchemas[payloadSchemaVersion]
  if (schema === undefined) {
    throw new Error(
      `Unknown payload schema version ${payloadSchemaVersion} for ${eventType}`
    )
  }
  return schema
}

export function assertEventTierEnabled(eventType: EventType): void {
  const registration = EVENT_REGISTRY[eventType]
  if (registration.tier !== 'LAUNCH') {
    throw new Error(
      `Audit event ${eventType} belongs to disabled delivery tier ${registration.tier}`
    )
  }
}
