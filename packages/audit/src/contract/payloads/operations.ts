import { z } from 'zod'
import {
  sha256Schema,
  stableCodeSchema,
  utcIsoMillisecondsSchema,
  uuidSchema,
} from './common.js'

export function bulkOperationPayloadSchema(
  status: 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'COMPLETED'
) {
  return z
    .object({
      operationId: uuidSchema,
      operationType: stableCodeSchema,
      itemId: z.string().min(1).max(128).optional(),
      status: z.literal(status),
      succeededCount: z.number().int().nonnegative().optional(),
      failedCount: z.number().int().nonnegative().optional(),
      reasonCode: stableCodeSchema.optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (status === 'FAILED' && value.reasonCode === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reasonCode'],
          message: 'failed bulk items require reasonCode',
        })
      }
    })
}

export const reportPayloadSchema = z
  .object({
    reportId: uuidSchema,
    version: z.number().int().positive(),
    snapshotHash: sha256Schema,
    previousReportId: uuidSchema.optional(),
    reasonCode: stableCodeSchema.optional(),
  })
  .strict()

export const evidenceAdministrationPayloadSchema = z
  .object({
    caseReference: z.string().min(1).max(256),
    referencedEventId: uuidSchema.optional(),
    participantId: uuidSchema.optional(),
    reviewAt: utcIsoMillisecondsSchema.optional(),
    reasonCode: stableCodeSchema,
    annotation: z.string().min(1).max(10_000).optional(),
  })
  .strict()

export const clientOperationPayloadSchema = z
  .object({
    streamId: uuidSchema,
    firstSequence: z.number().int().nonnegative(),
    lastSequence: z.number().int().nonnegative(),
    reasonCode: stableCodeSchema,
  })
  .strict()
  .refine((value) => value.lastSequence >= value.firstSequence, {
    message: 'lastSequence must not precede firstSequence',
  })

export function auditOperationPayloadSchema(operation: string) {
  return z
    .object({
      operation: z.literal(operation),
      referencedEventId: uuidSchema.optional(),
      batchId: uuidSchema.optional(),
      manifestId: uuidSchema.optional(),
      manifestHash: sha256Schema.optional(),
      attemptCount: z.number().int().nonnegative().optional(),
      providerStatusCode: z.number().int().min(100).max(599).optional(),
      firstObservedAt: utcIsoMillisecondsSchema.optional(),
      nextAttemptAt: utcIsoMillisecondsSchema.optional(),
      affectedRecordCount: z.number().int().nonnegative().optional(),
      reasonCode: stableCodeSchema.optional(),
    })
    .strict()
}

export type BulkOperationPayload = z.input<
  ReturnType<typeof bulkOperationPayloadSchema>
>
export type ReportPayload = z.input<typeof reportPayloadSchema>
export type EvidenceAdministrationPayload = z.input<
  typeof evidenceAdministrationPayloadSchema
>
export type ClientOperationPayload = z.input<
  typeof clientOperationPayloadSchema
>
export type AuditOperationPayload = z.input<
  ReturnType<typeof auditOperationPayloadSchema>
>
