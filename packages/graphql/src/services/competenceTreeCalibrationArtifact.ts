import {
  MAX_ABSOLUTE_THETA,
  MAX_DISCRIMINATION,
} from '@klicker-uzh/adaptive-learning'
import { z } from 'zod'

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const versionSchema = z.string().trim().min(1).max(160)
const finiteNumberSchema = z.number().finite()
const nonNegativeFiniteSchema = finiteNumberSchema.nonnegative()
const positiveIntegerSchema = z.number().int().positive()
const nonNegativeIntegerSchema = z.number().int().nonnegative()

export const MAX_ADAPTIVE_SCALE_LINK_ANCHORS = 1_000

export const ADAPTIVE_CALIBRATION_DIAGNOSTIC_CODES = [
  'CONVERGENCE_WARNING',
  'DIF_FLAG',
  'DRIFT_FLAG',
  'EXTREME_PARAMETER',
  'HOLDOUT_LOG_LOSS',
  'ITEM_MISFIT',
  'LOW_PARTICIPANT_COUNT',
  'LOW_RESPONSE_COUNT',
] as const

const diagnosticStatusSchema = z.enum(['PASS', 'WARN', 'FAIL'])
const diagnosticCodeSchema = z.enum(ADAPTIVE_CALIBRATION_DIAGNOSTIC_CODES)

const calibrationDiagnosticsSchema = z
  .object({
    policyVersion: positiveIntegerSchema,
    fitStatus: diagnosticStatusSchema,
    difStatus: diagnosticStatusSchema,
    driftStatus: diagnosticStatusSchema,
    fitStatistic: finiteNumberSchema.nullable(),
    difEffect: finiteNumberSchema.nullable(),
    driftEffect: finiteNumberSchema.nullable(),
    holdoutLogLoss: nonNegativeFiniteSchema.nullable(),
    codes: z.array(diagnosticCodeSchema).max(32),
  })
  .strict()

const calibrationEntrySchema = z
  .object({
    assignmentId: positiveIntegerSchema,
    elementVersion: positiveIntegerSchema,
    model: z.enum(['TWO_PL', 'THREE_PL_FIXED_C']),
    discrimination: finiteNumberSchema.positive().max(MAX_DISCRIMINATION),
    difficulty: finiteNumberSchema
      .min(-MAX_ABSOLUTE_THETA)
      .max(MAX_ABSOLUTE_THETA),
    guessing: finiteNumberSchema.min(0).lt(1),
    discriminationStandardError: nonNegativeFiniteSchema.nullable(),
    difficultyStandardError: nonNegativeFiniteSchema.nullable(),
    responseCount: nonNegativeIntegerSchema,
    participantCount: nonNegativeIntegerSchema,
    diagnostics: calibrationDiagnosticsSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.model === 'TWO_PL' && entry.guessing !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TWO_PL calibrations require guessing = 0.',
        path: ['guessing'],
      })
    }
    if (entry.participantCount > entry.responseCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'participantCount cannot exceed responseCount.',
        path: ['participantCount'],
      })
    }
  })

export const adaptiveCalibrationArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    treeId: z.string().uuid(),
    scaleVersionId: z.string().uuid(),
    datasetVersion: versionSchema,
    datasetChecksum: sha256Schema,
    calibrationJobId: versionSchema,
    generatedAt: z.string().datetime({ offset: true }),
    modelImplementationVersion: versionSchema,
    diagnosticsPolicyVersion: positiveIntegerSchema,
    calibrations: z.array(calibrationEntrySchema).min(1).max(100),
  })
  .strict()
  .superRefine((artifact, context) => {
    const identities = new Set<string>()
    artifact.calibrations.forEach((calibration, index) => {
      if (
        calibration.diagnostics.policyVersion !==
        artifact.diagnosticsPolicyVersion
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Calibration diagnostics policy version does not match.',
          path: ['calibrations', index, 'diagnostics', 'policyVersion'],
        })
      }

      const identity = `${calibration.assignmentId}:${calibration.elementVersion}`
      if (identities.has(identity)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate assignment and element-version identity.',
          path: ['calibrations', index],
        })
      }
      identities.add(identity)
    })
  })

const cutRationaleSchema = z
  .object({
    scaleLevelOrder: nonNegativeIntegerSchema,
    codes: z.array(z.string().trim().min(1).max(80)).min(1).max(16),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict()

export const adaptiveStandardSettingArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    treeId: z.string().uuid(),
    scaleVersionId: z.string().uuid(),
    method: z.enum(['ANGOFF', 'BOOKMARK', 'BODY_OF_WORK', 'OTHER']),
    methodVersion: versionSchema,
    panelSize: positiveIntegerSchema,
    standardSettingDate: z.string().datetime({ offset: true }),
    cutRationale: z.array(cutRationaleSchema).max(100),
    artifactChecksum: sha256Schema,
    artifactKey: z.string().trim().min(1).max(512),
  })
  .strict()
  .superRefine((artifact, context) => {
    const orders = new Set<number>()
    artifact.cutRationale.forEach((cut, index) => {
      if (orders.has(cut.scaleLevelOrder)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate scale-level rationale.',
          path: ['cutRationale', index, 'scaleLevelOrder'],
        })
      }
      orders.add(cut.scaleLevelOrder)
    })
  })

const linkMetricSchema = z
  .object({
    anchorCount: positiveIntegerSchema,
    intercept: finiteNumberSchema,
    slope: finiteNumberSchema.positive(),
    rootMeanSquareError: nonNegativeFiniteSchema,
    interceptStandardError: nonNegativeFiniteSchema,
    slopeStandardError: nonNegativeFiniteSchema,
  })
  .strict()

const scaleLinkAnchorSchema = z
  .object({
    fromCalibrationId: z.string().uuid(),
    toCalibrationId: z.string().uuid(),
  })
  .strict()

export const adaptiveScaleLinkArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    treeId: z.string().uuid(),
    fromScaleVersionId: z.string().uuid(),
    toScaleVersionId: z.string().uuid(),
    method: z.enum(['COMMON_ITEM_NONEQUIVALENT_GROUPS', 'FIXED_ANCHOR']),
    implementationVersion: versionSchema,
    generatedAt: z.string().datetime({ offset: true }),
    anchors: z
      .array(scaleLinkAnchorSchema)
      .min(1)
      .max(MAX_ADAPTIVE_SCALE_LINK_ANCHORS),
    fitMetrics: linkMetricSchema,
    uncertaintyMetrics: linkMetricSchema,
    artifactChecksum: sha256Schema,
    artifactKey: z.string().trim().min(1).max(512),
  })
  .strict()
  .superRefine((artifact, context) => {
    if (artifact.fromScaleVersionId === artifact.toScaleVersionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Scale links require different source and target scales.',
        path: ['toScaleVersionId'],
      })
    }
    if (
      artifact.fitMetrics.anchorCount !== artifact.anchors.length ||
      artifact.uncertaintyMetrics.anchorCount !== artifact.anchors.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Metric anchor counts must match the exact anchor list.',
        path: ['anchors'],
      })
    }

    const fromCalibrationIds = new Set<string>()
    const toCalibrationIds = new Set<string>()
    artifact.anchors.forEach((anchor, index) => {
      if (
        fromCalibrationIds.has(anchor.fromCalibrationId) ||
        toCalibrationIds.has(anchor.toCalibrationId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Each source and target calibration can appear in only one scale-link anchor.',
          path: ['anchors', index],
        })
      }
      fromCalibrationIds.add(anchor.fromCalibrationId)
      toCalibrationIds.add(anchor.toCalibrationId)
    })
  })

export const adaptiveEmpiricalValidationRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    configId: z.string().uuid(),
    treeId: z.string().uuid(),
    scaleVersionId: z.string().uuid(),
    exportRequestId: z.string().uuid(),
    criterionArtifactChecksum: sha256Schema,
    criterionArtifactKey: z
      .string()
      .trim()
      .regex(/^criteria\/[a-zA-Z0-9][a-zA-Z0-9._/-]{0,479}\.json$/),
  })
  .strict()

export type AdaptiveCalibrationArtifact = z.infer<
  typeof adaptiveCalibrationArtifactSchema
>
export type AdaptiveStandardSettingArtifact = z.infer<
  typeof adaptiveStandardSettingArtifactSchema
>
export type AdaptiveScaleLinkArtifact = z.infer<
  typeof adaptiveScaleLinkArtifactSchema
>
export type AdaptiveEmpiricalValidationRequest = z.infer<
  typeof adaptiveEmpiricalValidationRequestSchema
>

export function parseAdaptiveCalibrationArtifact(input: unknown) {
  return adaptiveCalibrationArtifactSchema.parse(input)
}

export function parseAdaptiveStandardSettingArtifact(input: unknown) {
  return adaptiveStandardSettingArtifactSchema.parse(input)
}

export function parseAdaptiveScaleLinkArtifact(input: unknown) {
  return adaptiveScaleLinkArtifactSchema.parse(input)
}

export function parseAdaptiveEmpiricalValidationRequest(input: unknown) {
  return adaptiveEmpiricalValidationRequestSchema.parse(input)
}
