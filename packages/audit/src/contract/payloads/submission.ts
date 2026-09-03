import { z } from 'zod'
import {
  normalizedAnswerSchema,
  sha256Schema,
  stableCodeSchema,
  utcIsoMillisecondsSchema,
  uuidSchema,
} from './common.js'

export function answerChangePayloadSchema(cleared: boolean) {
  return z
    .object({
      elementInstanceId: z.number().int().positive(),
      elementInstanceVersion: z.number().int().positive(),
      effectiveContentHash: sha256Schema,
      answer: cleared ? z.null() : normalizedAnswerSchema,
      trigger: z.enum(['IDLE', 'BLUR', 'NAVIGATION', 'SUBMIT', 'CLEAR']),
    })
    .strict()
    .refine((value) => !cleared || value.trigger === 'CLEAR', {
      message: 'cleared answer evidence requires the CLEAR trigger',
    })
}

export function submissionAttemptPayloadSchema(trigger: 'CLICK' | 'AUTO') {
  return z
    .object({
      submissionId: uuidSchema,
      trigger: z.literal(trigger),
      answerStateHash: sha256Schema,
    })
    .strict()
}

const submissionStageSchema = z.enum([
  'SERVER_ACCEPTED',
  'VALIDATED',
  'REJECTED',
  'DUPLICATE',
  'PERSISTED',
  'SCORED',
  'PROCESSING_FAILED',
  'PROCESSING_RECOVERED',
])

type SubmissionStage = z.infer<typeof submissionStageSchema>

export function submissionOutcomePayloadSchema(stage: SubmissionStage) {
  return z
    .object({
      submissionId: uuidSchema,
      stage: z.literal(stage),
      reasonCode: stableCodeSchema.optional(),
      responseId: z.number().int().positive().optional(),
      duplicateOfResponseId: z.number().int().positive().optional(),
      answerStateHash: sha256Schema.optional(),
      validationRulesVersion: z.string().min(1).optional(),
      scoringAlgorithmVersion: z.string().min(1).optional(),
      correctness: z.enum(['CORRECT', 'PARTIAL', 'WRONG']).optional(),
      basePoints: z.number().finite().optional(),
      correctnessPoints: z.number().finite().optional(),
      bonusPoints: z.number().finite().optional(),
    })
    .strict()
    .superRefine((value, context) => {
      const require = (field: keyof typeof value, message: string) => {
        if (value[field] === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message,
          })
        }
      }
      if (stage === 'SERVER_ACCEPTED') {
        require('answerStateHash', 'SERVER_ACCEPTED requires answerStateHash')
      }
      if (stage === 'VALIDATED') {
        require('validationRulesVersion', 'VALIDATED requires validationRulesVersion')
      }
      if (['REJECTED', 'PROCESSING_FAILED'].includes(stage)) {
        require('reasonCode', `${stage} requires a stable reasonCode`)
      }
      if (stage === 'DUPLICATE') {
        require('duplicateOfResponseId', 'DUPLICATE requires duplicateOfResponseId')
      }
      if (['PERSISTED', 'SCORED'].includes(stage)) {
        require('responseId', `${stage} requires responseId`)
      }
      if (stage === 'SCORED') {
        require('scoringAlgorithmVersion', 'SCORED requires scoringAlgorithmVersion')
        require('correctness', 'SCORED requires correctness')
        require('basePoints', 'SCORED requires basePoints')
        require('correctnessPoints', 'SCORED requires correctnessPoints')
        require('bonusPoints', 'SCORED requires bonusPoints')
      }
    })
}

export const responseSnapshotSchema = z
  .object({
    responseId: z.number().int().positive(),
    elementInstanceId: z.number().int().positive(),
    elementBlockExecution: z.number().int().nonnegative(),
    submittedAt: utcIsoMillisecondsSchema,
    answer: normalizedAnswerSchema.nullable(),
    answerHash: sha256Schema,
    correctness: z.enum(['CORRECT', 'PARTIAL', 'WRONG']),
    basePoints: z.number().finite(),
    correctnessPoints: z.number().finite(),
    bonusPoints: z.number().finite(),
    timeSpentSeconds: z.number().finite().nonnegative(),
  })
  .strict()

export function responseChangePayloadSchema(
  change:
    | 'MODIFIED'
    | 'DELETED'
    | 'RECOMPUTED'
    | 'CORRECTED'
    | 'RESET'
    | 'REMOVED'
) {
  if (change === 'RESET' || change === 'REMOVED') {
    return z
      .object({
        participantId: uuidSchema,
        affectedResponseIds: z
          .array(z.number().int().positive())
          .transform((ids) =>
            [...new Set(ids)].sort((left, right) => left - right)
          ),
        beforeAggregateHash: sha256Schema,
        afterAggregateHash: z.null(),
        reasonCode: stableCodeSchema,
      })
      .strict()
  }

  return z
    .object({
      participantId: uuidSchema,
      responseId: z.number().int().positive(),
      before: responseSnapshotSchema,
      after: change === 'DELETED' ? z.null() : responseSnapshotSchema,
      reasonCode: stableCodeSchema,
      algorithmVersion:
        change === 'RECOMPUTED' ? z.string().min(1) : z.undefined().optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.before.responseId !== value.responseId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['before', 'responseId'],
          message: 'before snapshot responseId must match responseId',
        })
      }
      if (value.after !== null && value.after.responseId !== value.responseId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['after', 'responseId'],
          message: 'after snapshot responseId must match responseId',
        })
      }
      if (
        value.after !== null &&
        JSON.stringify(value.before) === JSON.stringify(value.after)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${change} must change the response snapshot`,
        })
      }
    })
}

export type AnswerChangePayload = z.input<
  ReturnType<typeof answerChangePayloadSchema>
>
export type SubmissionAttemptPayload = z.input<
  ReturnType<typeof submissionAttemptPayloadSchema>
>
export type SubmissionOutcomePayload = z.input<
  ReturnType<typeof submissionOutcomePayloadSchema>
>
export type ResponseChangePayload = z.input<
  ReturnType<typeof responseChangePayloadSchema>
>
