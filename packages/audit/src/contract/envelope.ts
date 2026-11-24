import { z } from 'zod'
import { canonicalizeJson } from '../canonical/canonicalize.js'
import { hashCanonicalValue } from '../canonical/hash.js'
import {
  deriveAuditEventId,
  deriveAuditEventIdentity,
} from '../canonical/idempotency.js'
import {
  CRITICALITIES,
  type EVENT_REGISTRY,
  EVIDENCE_CLASSES,
  type EventPayload,
  type EventRegistration,
  type EventType,
  getEventPayloadSchema,
  getEventRegistration,
  RECORDED_VIA_VALUES,
  type RecordedVia,
} from './event-registry.js'
import {
  assertNoForbiddenEvidenceFields,
  type JsonValue,
  jsonValueSchema,
  stableCodeSchema,
  utcIsoMillisecondsSchema,
  uuidSchema,
} from './payloads/common.js'

const actorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('USER'), userId: uuidSchema }).strict(),
  z
    .object({ kind: z.literal('PARTICIPANT'), participantId: uuidSchema })
    .strict(),
  z.object({ kind: z.literal('SYSTEM') }).strict(),
  z
    .object({
      kind: z.literal('SERVICE'),
      serviceId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal('AZURE_PRINCIPAL'),
      principalObjectId: uuidSchema,
    })
    .strict(),
])

const initiatedBySchema = z.object({ userId: uuidSchema }).strict()

const authorizationSchema = z
  .object({
    decision: z.enum(['ALLOWED', 'DENIED', 'NOT_APPLICABLE']),
    authScope: stableCodeSchema,
    requiredPermission: stableCodeSchema.optional(),
    resolvedObjectScope: z
      .object({
        type: stableCodeSchema,
        id: z.string().min(1).max(128),
      })
      .strict()
      .optional(),
  })
  .strict()

const baseScopeSchema = z
  .object({
    liveQuizId: uuidSchema,
    lifecycleEpoch: z.number().int().nonnegative(),
    courseId: uuidSchema.optional(),
  })
  .strict()

const additionalScopeSchema = z
  .object({
    blockId: z.number().int().positive().optional(),
    elementInstanceId: z.number().int().positive().optional(),
    elementId: z.number().int().positive().optional(),
    participationId: z.number().int().positive().optional(),
    participantId: uuidSchema.optional(),
  })
  .strict()

const scopeSchema = baseScopeSchema.merge(additionalScopeSchema)

const envelopeSchema = z
  .object({
    eventId: uuidSchema,
    schemaVersion: z.literal(1),
    payloadSchemaVersion: z.number().int().positive(),
    eventType: z.string().min(1).max(128),
    criticality: z.enum(CRITICALITIES),
    evidenceClass: z.enum(EVIDENCE_CLASSES),
    recordedVia: z.enum(RECORDED_VIA_VALUES),
    receivedAt: utcIsoMillisecondsSchema,
    transportAttemptedAt: utcIsoMillisecondsSchema.optional(),
    transportAcceptedAt: utcIsoMillisecondsSchema.optional(),
    recordedAt: utcIsoMillisecondsSchema,
    actor: actorSchema,
    initiatedBy: initiatedBySchema.optional(),
    authorization: authorizationSchema,
    scope: scopeSchema,
    correlationId: uuidSchema,
    causationId: uuidSchema.optional(),
    submissionId: uuidSchema.optional(),
    hatchetEventId: z.string().min(1).max(256).optional(),
    outcome: stableCodeSchema.optional(),
    payload: jsonValueSchema,
    payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
    idempotencyKey: z.string().regex(/^[0-9a-f]{64}$/),
    eventHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()

const trustedContextInputSchema = z
  .object({
    recordedVia: z.enum(RECORDED_VIA_VALUES),
    receivedAt: z.union([z.date(), z.string().datetime({ offset: true })]),
    recordedAt: z
      .union([z.date(), z.string().datetime({ offset: true })])
      .optional(),
    transportAttemptedAt: z
      .union([z.date(), z.string().datetime({ offset: true })])
      .optional(),
    transportAcceptedAt: z
      .union([z.date(), z.string().datetime({ offset: true })])
      .optional(),
    actor: actorSchema,
    initiatedBy: initiatedBySchema.optional(),
    authorization: authorizationSchema,
    scope: baseScopeSchema,
    correlationId: uuidSchema,
  })
  .strict()

const draftSchema = z
  .object({
    eventType: z.string().min(1).max(128),
    producerOperationId: z.string().min(1).max(512),
    scope: additionalScopeSchema.optional(),
    causationId: uuidSchema.optional(),
    submissionId: uuidSchema.optional(),
    hatchetEventId: z.string().min(1).max(256).optional(),
    outcome: stableCodeSchema.optional(),
    payload: z.unknown(),
  })
  .strict()

const trustedContexts = new WeakSet<object>()

export type AuditActor = z.infer<typeof actorSchema>
export type AuditAuthorization = z.infer<typeof authorizationSchema>
export type AuditScope = z.infer<typeof scopeSchema>

export type TrustedAuditContext = Readonly<{
  recordedVia: RecordedVia
  receivedAt: string
  recordedAt: string
  transportAttemptedAt?: string
  transportAcceptedAt?: string
  actor: AuditActor
  initiatedBy?: z.infer<typeof initiatedBySchema>
  authorization: AuditAuthorization
  scope: z.infer<typeof baseScopeSchema>
  correlationId: string
}>

export type AuditEventDraft<T extends EventType = EventType> = {
  eventType: T
  producerOperationId: string
  scope?: z.infer<typeof additionalScopeSchema>
  causationId?: string
  submissionId?: string
  hatchetEventId?: string
  outcome?: string
  payload: EventPayload<T>
}

export type AuditEnvelope = {
  eventId: string
  schemaVersion: 1
  payloadSchemaVersion: number
  eventType: EventType
  criticality: (typeof EVENT_REGISTRY)[EventType]['criticality']
  evidenceClass: (typeof EVENT_REGISTRY)[EventType]['evidenceClass']
  recordedVia: RecordedVia
  receivedAt: string
  transportAttemptedAt?: string
  transportAcceptedAt?: string
  recordedAt: string
  actor: AuditActor
  initiatedBy?: z.infer<typeof initiatedBySchema>
  authorization: AuditAuthorization
  scope: AuditScope
  correlationId: string
  causationId?: string
  submissionId?: string
  hatchetEventId?: string
  outcome?: string
  payload: JsonValue
  payloadHash: string
  idempotencyKey: string
  eventHash: string
}

export type CanonicalAuditEvent = {
  envelope: AuditEnvelope
  canonicalEnvelope: string
}

function toUtcMilliseconds(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Audit timestamp is invalid')
  }
  return date.toISOString()
}

function optionalTimestamp(
  value: Date | string | undefined
): string | undefined {
  return value === undefined ? undefined : toUtcMilliseconds(value)
}

export function createTrustedAuditContext(
  input: z.input<typeof trustedContextInputSchema>
): TrustedAuditContext {
  const parsed = trustedContextInputSchema.parse(input)
  const receivedAt = toUtcMilliseconds(parsed.receivedAt)
  const recordedAt = toUtcMilliseconds(parsed.recordedAt ?? parsed.receivedAt)
  if (recordedAt < receivedAt) {
    throw new Error('recordedAt cannot precede receivedAt')
  }

  const context: TrustedAuditContext = Object.freeze({
    recordedVia: parsed.recordedVia,
    receivedAt,
    recordedAt,
    transportAttemptedAt: optionalTimestamp(parsed.transportAttemptedAt),
    transportAcceptedAt: optionalTimestamp(parsed.transportAcceptedAt),
    actor: parsed.actor,
    initiatedBy: parsed.initiatedBy,
    authorization: parsed.authorization,
    scope: parsed.scope,
    correlationId: parsed.correlationId,
  })
  trustedContexts.add(context)
  return context
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, nested]) => nested !== undefined)
  ) as T
}

type EventInvariantInput = Pick<
  AuditEnvelope,
  | 'eventType'
  | 'receivedAt'
  | 'transportAttemptedAt'
  | 'transportAcceptedAt'
  | 'recordedAt'
  | 'actor'
  | 'scope'
  | 'submissionId'
  | 'hatchetEventId'
  | 'payload'
>

function assertTrustedChronology(
  value: EventInvariantInput,
  registration: EventRegistration
): void {
  if (value.recordedAt < value.receivedAt) {
    throw new Error('recordedAt cannot precede receivedAt')
  }
  if (
    value.transportAttemptedAt !== undefined &&
    (value.transportAttemptedAt < value.receivedAt ||
      value.transportAttemptedAt > value.recordedAt)
  ) {
    throw new Error(
      'transportAttemptedAt must be between receivedAt and recordedAt'
    )
  }
  if (value.transportAcceptedAt !== undefined) {
    if (value.transportAttemptedAt === undefined) {
      throw new Error(
        'transportAcceptedAt requires transportAttemptedAt provenance'
      )
    }
    if (
      value.transportAcceptedAt < value.transportAttemptedAt ||
      value.transportAcceptedAt > value.recordedAt
    ) {
      throw new Error(
        'transportAcceptedAt must be between attempt and recording'
      )
    }
  }
  if (
    registration.requiresHatchetEventId &&
    value.transportAttemptedAt === undefined
  ) {
    throw new Error(
      `Audit event ${value.eventType} requires transportAttemptedAt`
    )
  }
}

function assertEventInvariants(
  value: EventInvariantInput,
  registration: EventRegistration
): void {
  assertEntityScopeConsistency(value)
  const participantId = value.scope.participantId
  if (registration.requiresParticipantScope && participantId === undefined) {
    throw new Error(`Audit event ${value.eventType} requires participant scope`)
  }
  if (
    value.actor.kind === 'PARTICIPANT' &&
    value.actor.participantId !== participantId
  ) {
    throw new Error('Participant actor does not match audit participant scope')
  }

  if (
    typeof value.payload === 'object' &&
    value.payload !== null &&
    !Array.isArray(value.payload)
  ) {
    if (
      'participantId' in value.payload &&
      value.payload.participantId !== participantId
    ) {
      throw new Error('Payload participantId does not match audit scope')
    }
    if (
      value.payload.subjectType === 'PARTICIPANT' &&
      value.payload.subjectId !== participantId
    ) {
      throw new Error('Payload participant subject does not match audit scope')
    }
    if (
      value.submissionId !== undefined &&
      'submissionId' in value.payload &&
      value.payload.submissionId !== value.submissionId
    ) {
      throw new Error('Envelope and payload submissionId values do not match')
    }
  }

  if (registration.requiresSubmissionId && value.submissionId === undefined) {
    throw new Error(`Audit event ${value.eventType} requires submissionId`)
  }
  if (
    registration.requiresHatchetEventId &&
    value.hatchetEventId === undefined
  ) {
    throw new Error(`Audit event ${value.eventType} requires hatchetEventId`)
  }
  assertTrustedChronology(value, registration)
}

function assertRequiredScopeIdentity(
  actual: string | number | undefined,
  expected: string | number,
  field: string
): void {
  if (actual === undefined) {
    throw new Error(`Audit event requires scope.${field}`)
  }
  if (actual !== expected) {
    throw new Error(`Audit scope.${field} does not match payload identity`)
  }
}

function assertEntityScopeConsistency(value: EventInvariantInput): void {
  if (
    typeof value.payload !== 'object' ||
    value.payload === null ||
    Array.isArray(value.payload)
  ) {
    return
  }
  const payload = value.payload

  if (value.eventType === 'ASSESSMENT_COURSE_ASSIGNMENT_CHANGED') {
    const expectedCourseId =
      (payload.courseIdAfter as string | null) ??
      (payload.courseIdBefore as string | null)
    if (expectedCourseId === null) {
      throw new Error('Course assignment evidence requires a course identity')
    }
    assertRequiredScopeIdentity(
      value.scope.courseId,
      expectedCourseId,
      'courseId'
    )
    return
  }

  if (
    typeof payload.entityType !== 'string' ||
    typeof payload.entityId !== 'string'
  ) {
    return
  }

  if (payload.entityType === 'ASSESSMENT') {
    assertRequiredScopeIdentity(
      value.scope.liveQuizId,
      payload.entityId,
      'liveQuizId'
    )
    return
  }

  if (payload.entityType === 'BLOCK') {
    assertRequiredScopeIdentity(
      value.scope.blockId,
      Number(payload.entityId),
      'blockId'
    )
    return
  }

  if (payload.entityType === 'ELEMENT_INSTANCE') {
    const snapshot =
      payload.after !== null
        ? payload.after
        : payload.before !== null
          ? payload.before
          : undefined
    if (
      typeof snapshot !== 'object' ||
      snapshot === null ||
      Array.isArray(snapshot)
    ) {
      throw new Error('ElementInstance evidence requires an entity snapshot')
    }
    assertRequiredScopeIdentity(
      value.scope.elementInstanceId,
      Number(payload.entityId),
      'elementInstanceId'
    )
    assertRequiredScopeIdentity(
      value.scope.blockId,
      snapshot.blockId as number,
      'blockId'
    )
    assertRequiredScopeIdentity(
      value.scope.elementId,
      snapshot.sourceElementId as number,
      'elementId'
    )
    return
  }

  if (payload.entityType === 'SOURCE_ELEMENT') {
    assertRequiredScopeIdentity(
      value.scope.elementId,
      Number(payload.entityId),
      'elementId'
    )
  }
}

export function createCanonicalAuditEvent(
  trustedContext: TrustedAuditContext,
  draftInput: AuditEventDraft
): CanonicalAuditEvent {
  if (!trustedContexts.has(trustedContext)) {
    throw new Error(
      'Audit context must be created with createTrustedAuditContext()'
    )
  }

  const draft = draftSchema.parse(draftInput)
  const registration = getEventRegistration(draft.eventType)
  const eventType = draft.eventType as EventType

  if (!registration.allowedRecordedVia.includes(trustedContext.recordedVia)) {
    throw new Error(
      `recordedVia ${trustedContext.recordedVia} is not allowed for ${eventType}`
    )
  }

  const payload = getEventPayloadSchema(
    eventType,
    registration.payloadSchemaVersion
  ).parse(draft.payload)
  const normalizedPayload = jsonValueSchema.parse(payload)
  assertNoForbiddenEvidenceFields(normalizedPayload)
  const scope = scopeSchema.parse({
    ...trustedContext.scope,
    ...draft.scope,
  })
  assertEventInvariants(
    {
      eventType,
      receivedAt: trustedContext.receivedAt,
      transportAttemptedAt: trustedContext.transportAttemptedAt,
      transportAcceptedAt: trustedContext.transportAcceptedAt,
      recordedAt: trustedContext.recordedAt,
      actor: trustedContext.actor,
      scope,
      submissionId: draft.submissionId,
      hatchetEventId: draft.hatchetEventId,
      payload: normalizedPayload,
    },
    registration
  )

  const { eventId, idempotencyKey } = deriveAuditEventIdentity({
    eventType,
    liveQuizId: trustedContext.scope.liveQuizId,
    lifecycleEpoch: trustedContext.scope.lifecycleEpoch,
    producerOperationId: draft.producerOperationId,
  })
  const payloadHash = hashCanonicalValue(normalizedPayload)

  const envelopeWithoutHash = compactObject({
    eventId,
    schemaVersion: 1 as const,
    payloadSchemaVersion: registration.payloadSchemaVersion,
    eventType,
    criticality: registration.criticality,
    evidenceClass: registration.evidenceClass,
    recordedVia: trustedContext.recordedVia,
    receivedAt: trustedContext.receivedAt,
    transportAttemptedAt: trustedContext.transportAttemptedAt,
    transportAcceptedAt: trustedContext.transportAcceptedAt,
    recordedAt: trustedContext.recordedAt,
    actor: trustedContext.actor,
    initiatedBy: trustedContext.initiatedBy,
    authorization: trustedContext.authorization,
    scope,
    correlationId: trustedContext.correlationId,
    causationId: draft.causationId,
    submissionId: draft.submissionId,
    hatchetEventId: draft.hatchetEventId,
    outcome: draft.outcome,
    payload: normalizedPayload,
    payloadHash,
    idempotencyKey,
  })
  const eventHash = hashCanonicalValue(envelopeWithoutHash)
  const envelope = {
    ...envelopeWithoutHash,
    eventHash,
  } as AuditEnvelope

  return {
    envelope,
    canonicalEnvelope: canonicalizeJson(envelope),
  }
}

export function parseCanonicalAuditEnvelope(
  canonicalEnvelope: string
): AuditEnvelope {
  const parsed: unknown = JSON.parse(canonicalEnvelope)
  const value = envelopeSchema.parse(parsed)
  const recanonicalized = canonicalizeJson(value)
  if (recanonicalized !== canonicalEnvelope) {
    throw new Error('Audit envelope is not RFC 8785 canonical JSON')
  }

  const registration = getEventRegistration(value.eventType)
  const eventType = value.eventType as EventType
  if (
    value.criticality !== registration.criticality ||
    value.evidenceClass !== registration.evidenceClass ||
    !registration.allowedRecordedVia.includes(value.recordedVia)
  ) {
    throw new Error(`Audit envelope metadata does not match ${eventType}`)
  }
  const payload = getEventPayloadSchema(
    eventType,
    value.payloadSchemaVersion
  ).parse(value.payload)
  const normalizedPayload = jsonValueSchema.parse(payload)
  assertNoForbiddenEvidenceFields(normalizedPayload)
  if (canonicalizeJson(normalizedPayload) !== canonicalizeJson(value.payload)) {
    throw new Error('Audit payload is not domain-normalized')
  }
  assertEventInvariants(
    { ...value, eventType, payload: normalizedPayload },
    registration
  )
  if (hashCanonicalValue(normalizedPayload) !== value.payloadHash) {
    throw new Error('Audit payload hash mismatch')
  }
  if (deriveAuditEventId(value.idempotencyKey) !== value.eventId) {
    throw new Error('Audit event identity mismatch')
  }

  const { eventHash, ...envelopeWithoutHash } = value
  if (hashCanonicalValue(envelopeWithoutHash) !== eventHash) {
    throw new Error('Audit event hash mismatch')
  }
  return value as AuditEnvelope
}

export { utcIsoMillisecondsSchema }
