import { z } from 'zod'

export const AuditEventSchema = z.object({
  // Required fields
  tenantId: z.string().min(1).max(100),
  subject: z.string().min(1).max(500),
  action: z.string().min(1).max(200),
  
  // Timestamp - if omitted, default to server time (epoch ms)
  timestamp: z.number().int().positive().optional().default(() => Date.now()),
  
  // Optional idempotency key - if provided, used as RowKey
  eventId: z.string().min(1).max(100).optional(),
  
  // Optional fields
  resourceId: z.string().max(500).optional(),
  sessionId: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  
  // Attributes - optional object for event metadata
  // Size limits are enforced by Azure Table Storage (we handle EntityTooLarge errors)
  attributes: z.record(z.unknown()).optional(),
})

export type AuditEvent = z.infer<typeof AuditEventSchema>