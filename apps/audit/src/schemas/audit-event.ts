import { z } from 'zod'

export const AuditEventSchema = z
  .object({
    // Required fields
    subject: z.string().min(1).max(500),
    action: z.string().min(1).max(200),

    // Timestamp - if omitted, default to server time (epoch ms)
    timestamp: z
      .number()
      .int()
      .positive()
      .optional()
      .default(() => Date.now()),

    // Optional idempotency key - if provided, used as RowKey
    eventId: z.string().min(1).max(100).optional(),

    // Optional fields
    resourceId: z.string().max(500).optional(),
    sessionId: z.string().max(100).optional(),
    userId: z.string().max(100).optional(),

    // Attributes - allowed but should be capped in size to stay within Azure property caps
    attributes: z.record(z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    // Enforce ~32KB attributes limit to stay within Azure Table Storage property limits
    if (val.attributes) {
      try {
        const serializedAttributes = JSON.stringify(val.attributes)
        const sizeInBytes = Buffer.byteLength(serializedAttributes, 'utf8')

        if (sizeInBytes > 32 * 1024) {
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
  })

export type AuditEvent = z.infer<typeof AuditEventSchema>
