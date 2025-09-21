import { z } from 'zod'

/**
 * Public audit event schema for frontend submissions
 * Excludes subject and userId fields (will be injected from verified JWT)
 */
export const PublicAuditEventSchema = z.object({
  // Required fields
  action: z.string().min(1).max(200), // Will be validated against whitelist

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

  // Attributes - allowed but should be capped in size to stay within Azure property caps
  attributes: z.record(z.unknown()).optional(),

  // Note: subject and userId will be overridden from JWT verification
})
// TODO: add below for size restrictions if facing issues
// .superRefine((val, ctx) => {
//   // Enforce ~32KB attributes limit to stay within Azure Table Storage property limits
//   if (val.attributes) {
//     try {
//       const serializedAttributes = JSON.stringify(val.attributes)
//       const sizeInBytes = Buffer.byteLength(serializedAttributes, 'utf8')

//       if (sizeInBytes > 32 * 1024) {
//         ctx.addIssue({
//           code: z.ZodIssueCode.custom,
//           message: `attributes exceeds 32KB limit (current size: ${Math.round(sizeInBytes / 1024)}KB)`,
//           path: ['attributes'],
//         })
//       }
//     } catch (error) {
//       ctx.addIssue({
//         code: z.ZodIssueCode.custom,
//         message: 'attributes must be JSON serializable',
//         path: ['attributes'],
//       })
//     }
//   }
// })

export type PublicAuditEvent = z.infer<typeof PublicAuditEventSchema>
