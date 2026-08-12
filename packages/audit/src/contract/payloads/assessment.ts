import { z } from 'zod'
import {
  sha256Schema,
  stableCodeSchema,
  utcIsoMillisecondsSchema,
  uuidSchema,
} from './common.js'

export const assessmentLifecycleStateSchema = z.enum([
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'DELETED',
])

export function lifecycleTransitionPayloadSchema(
  toState: z.infer<typeof assessmentLifecycleStateSchema>
) {
  return z
    .object({
      fromState: assessmentLifecycleStateSchema.nullable(),
      toState: z.literal(toState),
      reasonCode: stableCodeSchema.optional(),
      sourceLiveQuizId: uuidSchema.optional(),
    })
    .strict()
    .refine((value) => value.fromState !== value.toState, {
      message: 'assessment lifecycle transition must change state',
    })
}

export const assessmentModeChangedPayloadSchema = z
  .object({
    assessmentEnabledBefore: z.boolean(),
    assessmentEnabledAfter: z.boolean(),
    reasonCode: stableCodeSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.assessmentEnabledBefore !== value.assessmentEnabledAfter,
    { message: 'assessment mode must actually change' }
  )

export const courseAssignmentChangedPayloadSchema = z
  .object({
    courseIdBefore: uuidSchema.nullable(),
    courseIdAfter: uuidSchema.nullable(),
    reasonCode: stableCodeSchema.optional(),
  })
  .strict()
  .refine((value) => value.courseIdBefore !== value.courseIdAfter, {
    message: 'course assignment must actually change',
  })

export const assessmentConfigurationStateSchema = z
  .object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string().nullable(),
    accessMode: z.enum(['PUBLIC', 'RESTRICTED']),
    publicationStatus: stableCodeSchema,
    reviewStatus: stableCodeSchema,
    availableFrom: utcIsoMillisecondsSchema.nullable(),
    isLiveQAEnabled: z.boolean(),
    isConfusionFeedbackEnabled: z.boolean(),
    isModerationEnabled: z.boolean(),
    isGamificationEnabled: z.boolean(),
    isAssessmentEnabled: z.boolean(),
    areInstancesOutdated: z.boolean(),
    pointsMultiplier: z.number().int().nonnegative(),
    defaultPoints: z.number().int().nonnegative(),
    defaultCorrectPoints: z.number().int().nonnegative(),
    maximumBonusPoints: z.number().int().nonnegative(),
    secondsToZeroBonus: z.number().int().nonnegative(),
    activeBlockId: z.number().int().positive().nullable(),
  })
  .strict()

export const blockStateSchema = z
  .object({
    blockId: z.number().int().positive(),
    order: z.number().int().nonnegative(),
    timeLimitSeconds: z.number().int().nonnegative().nullable(),
    expiresAt: utcIsoMillisecondsSchema.nullable(),
    randomSelectionCount: z.number().int().positive().nullable(),
    execution: z.number().int().nonnegative(),
    status: z.enum(['SCHEDULED', 'ACTIVE', 'EXECUTED']),
    startedAt: utcIsoMillisecondsSchema.nullable(),
    closedAt: utcIsoMillisecondsSchema.nullable(),
  })
  .strict()

const answerOptionContentSchema = z
  .object({
    optionId: z.number().int().nonnegative(),
    value: z.string(),
    feedback: z.string().nullable(),
  })
  .strict()

const numericalRangeSchema = z
  .object({
    minimum: z.number().finite().nullable(),
    maximum: z.number().finite().nullable(),
  })
  .strict()

const selectionItemSchema = z
  .object({
    itemId: z.number().int().positive(),
    value: z.string(),
  })
  .strict()

const caseStudyCriterionSchema = z
  .object({
    criterionId: z.string().min(1),
    name: z.string(),
    order: z.number().int().nonnegative().nullable(),
    minimum: z.number().finite(),
    maximum: z.number().finite(),
    step: z.number().finite().positive(),
    unit: z.string().nullable(),
    labels: z
      .object({
        minimum: z.string(),
        midpoint: z.string().nullable(),
        maximum: z.string(),
      })
      .strict()
      .nullable(),
  })
  .strict()

const caseStudyCaseSchema = z
  .object({
    caseId: z.string().min(1),
    title: z.string(),
    description: z.string(),
    order: z.number().int().nonnegative().nullable(),
  })
  .strict()

export const elementContentOptionsSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.enum(['SC', 'MC', 'KPRIM']),
      displayMode: z.enum(['LIST', 'GRID']),
      options: z
        .array(answerOptionContentSchema)
        .transform((options) =>
          [...options].sort((left, right) => left.optionId - right.optionId)
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('FREE_TEXT'),
      placeholder: z.string().nullable(),
      maximumLength: z.number().int().nonnegative().nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('NUMERICAL'),
      unit: z.string().nullable(),
      accuracy: z.number().finite().nullable(),
      placeholder: z.string().nullable(),
      restrictions: numericalRangeSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('SELECTION'),
      numberOfInputs: z.number().int().nonnegative(),
      answerCollectionId: z.number().int().positive().nullable(),
      items: z
        .array(selectionItemSchema)
        .transform((items) =>
          [...items].sort((left, right) => left.itemId - right.itemId)
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('CASE_STUDY'),
      answerCollectionId: z.number().int().positive().nullable(),
      items: z
        .array(selectionItemSchema)
        .transform((items) =>
          [...items].sort((left, right) => left.itemId - right.itemId)
        ),
      criteria: z.array(caseStudyCriterionSchema).transform((criteria) =>
        [...criteria].sort((left, right) => {
          const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
          const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
          return (
            leftOrder - rightOrder ||
            left.criterionId.localeCompare(right.criterionId)
          )
        })
      ),
      cases: z.array(caseStudyCaseSchema).transform((cases) =>
        [...cases].sort((left, right) => {
          const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
          const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
          return (
            leftOrder - rightOrder || left.caseId.localeCompare(right.caseId)
          )
        })
      ),
    })
    .strict(),
  z.object({ kind: z.literal('CONTENT') }).strict(),
  z.object({ kind: z.literal('FLASHCARD') }).strict(),
])

const caseStudyCriterionSolutionSchema = z
  .object({
    criterionId: z.string().min(1),
    minimum: z.number().finite(),
    maximum: z.number().finite(),
  })
  .strict()

const caseStudyItemSolutionSchema = z
  .object({
    itemId: z.number().int().positive(),
    criteria: z.array(caseStudyCriterionSolutionSchema),
  })
  .strict()

const caseStudyCaseSolutionSchema = z
  .object({
    caseId: z.string().min(1),
    items: z.array(caseStudyItemSolutionSchema),
  })
  .strict()

export const elementScoringRulesSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.enum(['SC', 'MC', 'KPRIM']),
      correctOptionIds: z
        .array(z.number().int().nonnegative())
        .transform((ids) =>
          [...new Set(ids)].sort((left, right) => left - right)
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('FREE_TEXT'),
      acceptedAnswers: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      kind: z.literal('NUMERICAL'),
      exactSolutions: z.array(z.number().finite()),
      solutionRanges: z.array(numericalRangeSchema),
    })
    .strict(),
  z
    .object({
      kind: z.literal('SELECTION'),
      correctItemIds: z
        .array(z.number().int().positive())
        .transform((ids) =>
          [...new Set(ids)].sort((left, right) => left - right)
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('CASE_STUDY'),
      cases: z.array(caseStudyCaseSolutionSchema),
    })
    .strict(),
  z.object({ kind: z.literal('CONTENT') }).strict(),
  z.object({ kind: z.literal('FLASHCARD') }).strict(),
])

const elementTypeSchema = z.enum([
  'SC',
  'MC',
  'KPRIM',
  'FREE_TEXT',
  'NUMERICAL',
  'SELECTION',
  'CASE_STUDY',
  'CONTENT',
  'FLASHCARD',
])

export const effectiveElementContentSchema = z
  .object({
    elementType: elementTypeSchema,
    name: z.string(),
    content: z.string(),
    explanation: z.string().nullable(),
    hasSampleSolution: z.boolean(),
    hasAnswerFeedbacks: z.boolean(),
    contentOptions: elementContentOptionsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.contentOptions.kind !== value.elementType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'element type and content options must match',
      })
    }
  })

export const elementScoringSnapshotSchema = z
  .object({
    elementType: elementTypeSchema,
    basePointsEnabled: z.boolean(),
    pointsMultiplier: z.number().int().nonnegative(),
    scoringRules: elementScoringRulesSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scoringRules.kind !== value.elementType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'element type and scoring rules must match',
      })
    }
  })

export const effectiveElementSnapshotSchema = z
  .object({
    content: effectiveElementContentSchema,
    scoring: elementScoringSnapshotSchema,
  })
  .strict()
  .refine((value) => value.content.elementType === value.scoring.elementType, {
    message: 'effective content and scoring element types must match',
  })

export const elementInstanceStateSchema = z
  .object({
    elementInstanceId: z.number().int().positive(),
    blockId: z.number().int().positive(),
    order: z.number().int().nonnegative(),
    sourceElementId: z.number().int().positive(),
    sourceElementVersion: z.number().int().positive(),
    isVersionOutdated: z.boolean(),
    effectiveElement: effectiveElementSnapshotSchema,
    effectiveContentHash: sha256Schema,
    effectiveSolutionHash: sha256Schema,
  })
  .strict()

export const sourceElementStateSchema = z
  .object({
    sourceElementId: z.number().int().positive(),
    sourceElementVersion: z.number().int().positive(),
    sourceElement: effectiveElementSnapshotSchema,
    sourceContentHash: sha256Schema,
    effectiveContentChanged: z.boolean(),
  })
  .strict()

export const mediaStateSchema = z
  .object({
    mediaId: uuidSchema,
    sourceUrl: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value)
        return (
          url.protocol === 'https:' &&
          url.username === '' &&
          url.password === '' &&
          url.search === '' &&
          url.hash === ''
        )
      }, 'media sourceUrl must be a query-free HTTPS URL'),
    contentHash: sha256Schema,
    byteLength: z.number().int().positive(),
    mimeType: z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/),
    blobName: z.string().regex(/^sha256\/[0-9a-f]{64}$/),
    sourceReferenceHash: sha256Schema,
  })
  .strict()

const configurationStateByEntity = {
  ASSESSMENT: assessmentConfigurationStateSchema,
  BLOCK: blockStateSchema,
  ELEMENT_INSTANCE: elementInstanceStateSchema,
  SOURCE_ELEMENT: sourceElementStateSchema,
  MEDIA: mediaStateSchema,
} as const

type ConfigurationEntityType = keyof typeof configurationStateByEntity

const positiveIntegerEntityIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => Number.isSafeInteger(Number(value)), {
    message: 'entityId must be a safe positive integer',
  })

const configurationEntityIdSchemas = {
  ASSESSMENT: uuidSchema,
  BLOCK: positiveIntegerEntityIdSchema,
  ELEMENT_INSTANCE: positiveIntegerEntityIdSchema,
  SOURCE_ELEMENT: positiveIntegerEntityIdSchema,
  MEDIA: uuidSchema,
} as const

export function configurationChangePayloadSchema(
  entityType: ConfigurationEntityType,
  change: 'CREATED' | 'UPDATED' | 'DELETED',
  allowedChangedFields?: readonly string[]
) {
  const stateSchema = configurationStateByEntity[entityType]
  const entityIdSchema = configurationEntityIdSchemas[entityType]
  return z
    .object({
      entityType: z.literal(entityType),
      entityId: entityIdSchema,
      before: change === 'CREATED' ? z.null() : stateSchema,
      after: change === 'DELETED' ? z.null() : stateSchema,
      reasonCode: stableCodeSchema.optional(),
    })
    .strict()
    .superRefine((value, context) => {
      const expectedEntityId =
        entityType === 'ASSESSMENT' || entityType === 'MEDIA'
          ? value.entityId
          : Number(value.entityId)
      for (const [snapshotName, snapshot] of [
        ['before', value.before],
        ['after', value.after],
      ] as const) {
        if (snapshot === null || entityType === 'ASSESSMENT') {
          continue
        }
        const snapshotRecord = snapshot as unknown as Record<string, unknown>
        const snapshotEntityId =
          entityType === 'BLOCK'
            ? snapshotRecord.blockId
            : entityType === 'ELEMENT_INSTANCE'
              ? snapshotRecord.elementInstanceId
              : entityType === 'SOURCE_ELEMENT'
                ? snapshotRecord.sourceElementId
                : snapshotRecord.mediaId
        if (snapshotEntityId !== expectedEntityId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [snapshotName],
            message: `${snapshotName} snapshot identity must match entityId`,
          })
        }
      }

      if (
        change !== 'UPDATED' ||
        value.before === null ||
        value.after === null
      ) {
        return
      }
      const changedFields = Object.keys(value.before).filter(
        (field) =>
          JSON.stringify(value.before?.[field as keyof typeof value.before]) !==
          JSON.stringify(value.after?.[field as keyof typeof value.after])
      )
      if (changedFields.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'configuration update must change at least one field',
        })
      }
      if (
        allowedChangedFields !== undefined &&
        changedFields.some((field) => !allowedChangedFields.includes(field))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `configuration update changed fields outside ${allowedChangedFields.join(', ')}`,
        })
      }
    })
}

export function accessChangePayloadSchema(subjectType: 'PARTICIPANT' | 'USER') {
  const changeSchema =
    subjectType === 'PARTICIPANT'
      ? z.enum(['ADDED', 'REMOVED'])
      : z.enum(['GRANTED', 'REVOKED'])
  return z
    .object({
      subjectType: z.literal(subjectType),
      subjectId: uuidSchema,
      change: changeSchema,
      permission:
        subjectType === 'USER' ? stableCodeSchema : z.undefined().optional(),
      reasonCode: stableCodeSchema.optional(),
    })
    .strict()
}

export function sessionPayloadSchema(
  transition: 'STARTED' | 'RESUMED' | 'ENDED'
) {
  return z
    .object({
      sessionId: uuidSchema,
      transition: z.literal(transition),
      reasonCode: stableCodeSchema.optional(),
    })
    .strict()
}

export const rejectedActionPayloadSchema = z
  .object({
    actionType: stableCodeSchema,
    reasonCode: stableCodeSchema,
    targetType: stableCodeSchema.optional(),
    targetId: z.string().min(1).max(128).optional(),
  })
  .strict()

export type LifecycleTransitionPayload = z.input<
  ReturnType<typeof lifecycleTransitionPayloadSchema>
>
export type AssessmentModeChangedPayload = z.input<
  typeof assessmentModeChangedPayloadSchema
>
export type CourseAssignmentChangedPayload = z.input<
  typeof courseAssignmentChangedPayloadSchema
>
export type ConfigurationChangePayload = z.input<
  ReturnType<typeof configurationChangePayloadSchema>
>
export type AccessChangePayload = z.input<
  ReturnType<typeof accessChangePayloadSchema>
>
export type SessionPayload = z.input<ReturnType<typeof sessionPayloadSchema>>
export type RejectedActionPayload = z.input<typeof rejectedActionPayloadSchema>
