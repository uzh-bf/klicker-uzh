import {
  AuditAction,
  AuditScope,
  type CorrelationClaims,
} from '@klicker-uzh/types'
import { z } from 'zod'

export const ALLOWED_PUBLIC_ACTIONS = [
  AuditAction.PARTICIPANT_VIEW_INSTANCE,
  AuditAction.PARTICIPANT_SUBMIT_RESPONSE,
  AuditAction.PARTICIPANT_UPDATE_ANSWER,
  AuditAction.PARTICIPANT_JOIN_QUIZ,
  AuditAction.PARTICIPANT_QUIZ_PIN_SUCCESS,
  AuditAction.PARTICIPANT_QUIZ_PIN_FAILED,
  AuditAction.CLIENT_ERROR,
]

const ALLOWED_PUBLIC_ACTIONS_SET = new Set<string>(ALLOWED_PUBLIC_ACTIONS)

const CORRELATION_ID_REGEX = /^[a-f0-9]{32}$/i
const ATTRIBUTES_MAX_BYTES = 32 * 1024
const DEFAULT_SCHEMA_VERSION = 1

const CorrelationClaimsSchema: z.ZodType<CorrelationClaims> = z.object({
  liveQuizId: z.string().min(1).max(100),
  instanceId: z.union([z.string(), z.number()]),
  execution: z.union([z.string(), z.number()]),
})

export const AuditEventSchema = z
  .object({
    schemaVersion: z.number().int().positive().default(DEFAULT_SCHEMA_VERSION),

    eventId: z.string().min(1).max(100).optional(),
    timestamp: z
      .number()
      .int()
      .positive()
      .optional()
      .default(() => Date.now()),
    scope: z.nativeEnum(AuditScope).default(AuditScope.INTERNAL),

    // outcome: z.string().min(1).max(100).optional(),
    // reasonCode: z.string().min(1).max(200).optional(),

    subject: z.string().min(1).max(500),
    action: z.nativeEnum(AuditAction),
    resource: z.string().max(500).optional(),
    stage: z.string().min(1).max(100).optional(),

    correlationId: z
      .string()
      .regex(
        CORRELATION_ID_REGEX,
        'correlationId must be a 32 character hex string'
      )
      .optional(),
    correlationClaims: CorrelationClaimsSchema.optional(),

    attributes: z.record(z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    const scope = val.scope ?? AuditScope.INTERNAL

    if (
      scope === AuditScope.PUBLIC &&
      !ALLOWED_PUBLIC_ACTIONS_SET.has(val.action)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Event action '${val.action}' is not allowed for public scope`,
        path: ['action'],
      })
    }

    if (
      scope !== AuditScope.PUBLIC &&
      (!val.subject || val.subject.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'subject is required for non-public events',
        path: ['subject'],
      })
    }

    if (val.attributes) {
      try {
        const serializedAttributes = JSON.stringify(val.attributes)
        const sizeInBytes = Buffer.byteLength(serializedAttributes, 'utf8')

        if (sizeInBytes > ATTRIBUTES_MAX_BYTES) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `attributes exceeds 32KB limit (current size: ${Math.round(sizeInBytes / 1024)}KB)`,
            path: ['attributes'],
          })
        }
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'attributes must be JSON serializable',
          path: ['attributes'],
        })
      }
    }

    if (val.correlationClaims) {
      try {
        JSON.stringify(val.correlationClaims)
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'correlationClaims must be JSON serializable',
          path: ['correlationClaims'],
        })
      }
    }
  })

export type AuditEvent = z.infer<typeof AuditEventSchema>
