import { z } from 'zod'

export const ALLOWED_PUBLIC_ACTIONS = [
  'response.submitted',
  'session.joined',
  'session.left',
  'quiz.started',
  'quiz.completed',
  'feedback.submitted',
  'question.answered',
  'activity.accessed',
] as const

const ALLOWED_PUBLIC_ACTIONS_SET = new Set<string>(ALLOWED_PUBLIC_ACTIONS)

const CORRELATION_ID_REGEX = /^[a-f0-9]{32}$/i
const ATTRIBUTES_MAX_BYTES = 32 * 1024
const DEFAULT_SCHEMA_VERSION = 1

const CorrelationClaimsSchema = z
  .object({
    liveQuizId: z.string().min(1).max(100).optional(),
    instanceId: z.union([z.string(), z.number()]).optional(),
    execution: z.union([z.string(), z.number()]).optional(),
  })
  .refine((claims) => Object.keys(claims).length > 0, {
    message: 'correlationClaims must include at least one value',
  })

export const AuditEventSchema = z
  .object({
    scope: z.enum(['public', 'internal', 'worker']).default('internal'),
    subject: z.string().min(1).max(500).optional(),
    action: z.string().min(1).max(200),
    timestamp: z
      .number()
      .int()
      .positive()
      .optional()
      .default(() => Date.now()),
    eventId: z.string().min(1).max(100).optional(),
    resourceId: z.string().max(500).optional(),
    sessionId: z.string().max(100).optional(),
    userId: z.string().max(100).optional(),
    correlationId: z
      .string()
      .regex(
        CORRELATION_ID_REGEX,
        'correlationId must be a 32 character hex string'
      )
      .optional(),
    correlationClaims: CorrelationClaimsSchema.optional(),
    stage: z.string().min(1).max(100).optional(),
    outcome: z.string().min(1).max(100).optional(),
    reasonCode: z.string().min(1).max(200).optional(),
    schemaVersion: z.number().int().positive().default(DEFAULT_SCHEMA_VERSION),
    attributes: z.record(z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    const scope = val.scope ?? 'internal'

    if (scope === 'public' && !ALLOWED_PUBLIC_ACTIONS_SET.has(val.action)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Event action '${val.action}' is not allowed for public scope`,
        path: ['action'],
      })
    }

    if (scope !== 'public' && (!val.subject || val.subject.length === 0)) {
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
