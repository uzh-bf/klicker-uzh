import { z } from 'zod'
import {
  assessmentConfigurationStateSchema,
  assessmentLifecycleStateSchema,
  blockStateSchema,
  effectiveElementContentSchema,
  elementScoringSnapshotSchema,
  mediaStateSchema,
} from './assessment.js'
import {
  sha256Schema,
  stableCodeSchema,
  utcIsoMillisecondsSchema,
  uuidSchema,
} from './common.js'

export const baselineKindSchema = z.enum([
  'CREATION',
  'ROLLOUT_CONFIGURATION_CURRENT_STATE',
  'REOPENING',
])

export const coverageStateSchema = z.enum([
  'UNCOVERED',
  'ACTIVATING',
  'COVERED',
  'EXCLUDED_TERMINAL',
  'FAILED',
])

const baselinePartCountsSchema = z
  .object({
    configuration: z.number().int().nonnegative(),
    blocks: z.number().int().nonnegative(),
    elementInstances: z.number().int().nonnegative(),
    solutionsAndScoring: z.number().int().nonnegative(),
    participantEligibility: z.number().int().nonnegative(),
    lecturerPermissions: z.number().int().nonnegative(),
    mediaReferences: z.number().int().nonnegative(),
    limitations: z.number().int().nonnegative(),
  })
  .strict()

const assessmentConfigurationPartSchema = z
  .object({
    kind: z.literal('ASSESSMENT_CONFIGURATION'),
    courseId: uuidSchema.nullable(),
    configuration: assessmentConfigurationStateSchema,
  })
  .strict()

const blockPartSchema = z
  .object({
    kind: z.literal('BLOCK'),
    block: blockStateSchema,
  })
  .strict()

const elementInstancePartSchema = z
  .object({
    kind: z.literal('ELEMENT_INSTANCE'),
    elementInstanceId: z.number().int().positive(),
    blockId: z.number().int().positive(),
    order: z.number().int().nonnegative(),
    sourceElementId: z.number().int().positive(),
    sourceElementVersion: z.number().int().positive(),
    isVersionOutdated: z.boolean(),
    effectiveContent: effectiveElementContentSchema,
    effectiveContentHash: sha256Schema,
  })
  .strict()

const solutionAndScoringPartSchema = z
  .object({
    kind: z.literal('SOLUTION_AND_SCORING'),
    elementInstanceId: z.number().int().positive(),
    scoring: elementScoringSnapshotSchema,
    effectiveSolutionHash: sha256Schema,
    algorithmVersion: z.string().min(1),
  })
  .strict()

const participantEligibilityPartSchema = z
  .object({
    kind: z.literal('PARTICIPANT_ELIGIBILITY'),
    participantId: uuidSchema,
    eligible: z.boolean(),
  })
  .strict()

const lecturerPermissionPartSchema = z
  .object({
    kind: z.literal('LECTURER_PERMISSION'),
    userId: uuidSchema,
    permission: stableCodeSchema,
    effective: z.boolean(),
  })
  .strict()

const mediaReferencePartSchema = z
  .object({
    kind: z.literal('MEDIA_REFERENCE'),
    media: mediaStateSchema,
  })
  .strict()

const limitationPartSchema = z
  .object({
    kind: z.literal('LIMITATION'),
    subjectType: stableCodeSchema,
    subjectId: z.string().min(1).max(128).optional(),
    reasonCode: stableCodeSchema,
  })
  .strict()

export const baselinePartContentSchema = z.discriminatedUnion('kind', [
  assessmentConfigurationPartSchema,
  blockPartSchema,
  elementInstancePartSchema,
  solutionAndScoringPartSchema,
  participantEligibilityPartSchema,
  lecturerPermissionPartSchema,
  mediaReferencePartSchema,
  limitationPartSchema,
])

export const auditActivatedPayloadSchema = z
  .object({
    baselineId: uuidSchema,
    baselineKind: baselineKindSchema,
    coverageState: z.literal('COVERED'),
    activatedAt: utcIsoMillisecondsSchema,
  })
  .strict()

export const rolloutBaselinePayloadSchema = z
  .object({
    scanId: uuidSchema,
    observedAt: utcIsoMillisecondsSchema,
    observedLifecycleState: assessmentLifecycleStateSchema,
    lifecycleEpoch: z.number().int().nonnegative(),
    outcome: z.enum([
      'ACTIVATED',
      'ROLLOUT_BASELINED',
      'EXCLUDED_TERMINAL',
      'FAILED',
    ]),
    coverageState: z.enum(['COVERED', 'EXCLUDED_TERMINAL', 'UNCOVERED']),
    baselineId: uuidSchema.nullable(),
    terminalAt: utcIsoMillisecondsSchema.nullable(),
    retentionAnchorAt: utcIsoMillisecondsSchema.nullable(),
    reasonCode: stableCodeSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const terminalLifecycleStates = new Set([
      'COMPLETED',
      'CANCELLED',
      'DELETED',
    ])
    const isTerminalLifecycleState = terminalLifecycleStates.has(
      value.observedLifecycleState
    )
    const issue = (path: string, message: string) => {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message,
      })
    }
    if (['ACTIVATED', 'ROLLOUT_BASELINED'].includes(value.outcome)) {
      if (value.coverageState !== 'COVERED') {
        issue('coverageState', 'activated rollout evidence must be covered')
      }
      if (value.baselineId === null) {
        issue('baselineId', 'activated rollout evidence requires a baseline')
      }
      if (
        isTerminalLifecycleState ||
        value.terminalAt !== null ||
        value.retentionAnchorAt !== null ||
        value.reasonCode !== null
      ) {
        issue('outcome', 'activated rollout evidence cannot be terminal')
      }
    }
    if (value.outcome === 'EXCLUDED_TERMINAL') {
      if (value.coverageState !== 'EXCLUDED_TERMINAL') {
        issue('coverageState', 'terminal exclusion must use terminal coverage')
      }
      if (
        !isTerminalLifecycleState ||
        value.baselineId !== null ||
        value.terminalAt === null ||
        value.retentionAnchorAt !== value.terminalAt ||
        value.reasonCode === null
      ) {
        issue(
          'outcome',
          'terminal exclusion requires matching terminal/anchor and a reason'
        )
      }
      if (value.terminalAt !== null && value.terminalAt > value.observedAt) {
        issue('terminalAt', 'terminalAt cannot follow rollout observation')
      }
    }
    if (value.outcome === 'FAILED') {
      if (
        isTerminalLifecycleState ||
        value.coverageState !== 'UNCOVERED' ||
        value.baselineId !== null ||
        value.terminalAt !== null ||
        value.retentionAnchorAt !== null ||
        value.reasonCode === null
      ) {
        issue(
          'outcome',
          'failed rollout evidence must remain uncovered with a reason'
        )
      }
    }
  })

export const baselineRootPayloadSchema = z
  .object({
    baselineId: uuidSchema,
    baselineKind: baselineKindSchema,
    baselineSchemaVersion: z.literal(1),
    capturedAt: utcIsoMillisecondsSchema,
    expectedPartCounts: baselinePartCountsSchema,
    aggregateHash: sha256Schema,
  })
  .strict()

export const baselinePartPayloadSchema = z
  .object({
    baselineId: uuidSchema,
    baselineKind: baselineKindSchema,
    baselineSchemaVersion: z.literal(1),
    capturedAt: utcIsoMillisecondsSchema,
    partKey: z.string().regex(/^[A-Z][A-Z0-9_]*\|[^|]+$/),
    content: baselinePartContentSchema,
    contentHash: sha256Schema,
  })
  .strict()

export type AuditActivatedPayload = z.input<typeof auditActivatedPayloadSchema>
export type RolloutBaselinePayload = z.input<
  typeof rolloutBaselinePayloadSchema
>
export type BaselineRootPayload = z.input<typeof baselineRootPayloadSchema>
export type BaselinePartPayload = z.input<typeof baselinePartPayloadSchema>
