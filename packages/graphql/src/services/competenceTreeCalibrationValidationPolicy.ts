import {
  estimateEapPosterior,
  type AdaptiveScaleDefinition,
  type AdaptiveScoredItem,
  type AdaptiveScoredResponse,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { z } from 'zod'

const MINIMUM_VALIDATION_STRATUM_SIZE = 30
const MAXIMUM_VALIDATION_SUBJECTS = 10_000
const WILSON_95_Z = 1.959963984540054
const MINIMUM_LOG_PROBABILITY = 1e-12

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const pseudonymSchema = z.string().regex(/^[a-f0-9]{64}$/)

const criterionSubjectSchema = z
  .object({
    subjectPseudonym: pseudonymSchema,
    levelOrder: z.number().int().nonnegative().max(99),
    strata: z
      .array(z.string().trim().min(1).max(120))
      .min(1)
      .max(16)
      .refine((values) => new Set(values).size === values.length, {
        message: 'Criterion strata must be unique for each subject.',
      }),
  })
  .strict()

export const adaptiveValidationCriterionSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportRequestId: z.string().uuid(),
    holdoutArtifactChecksum: sha256Schema,
    criterionVersion: z.string().trim().min(1).max(160),
    generatedAt: z.string().datetime({ offset: true }),
    subjects: z
      .array(criterionSubjectSchema)
      .min(MINIMUM_VALIDATION_STRATUM_SIZE)
      .max(MAXIMUM_VALIDATION_SUBJECTS),
  })
  .strict()
  .superRefine((artifact, context) => {
    const pseudonyms = new Set<string>()
    artifact.subjects.forEach((subject, index) => {
      if (pseudonyms.has(subject.subjectPseudonym)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Criterion subject pseudonyms must be unique.',
          path: ['subjects', index, 'subjectPseudonym'],
        })
      }
      pseudonyms.add(subject.subjectPseudonym)
    })
  })

export const adaptiveValidationHoldoutRowSchema = z
  .object({
    schemaVersion: z.literal(1),
    subjectPseudonym: pseudonymSchema,
    cohortPseudonym: pseudonymSchema,
    publicationVersion: z.number().int().positive(),
    measurementVersion: z.nativeEnum(DB.AdaptiveMeasurementVersion),
    estimatorImplementationVersion: z.string().trim().min(1).max(160),
    classificationPolicyVersion: z.number().int().positive(),
    calibrationPolicyVersion: z.number().int().positive(),
    assignmentId: z.number().int().positive(),
    elementId: z.number().int().positive(),
    elementVersion: z.number().int().positive(),
    elementType: z.nativeEnum(DB.ElementType),
    calibrationId: z.string().uuid(),
    calibrationVersion: z.number().int().positive(),
    calibrationStatus: z.nativeEnum(DB.AdaptiveItemCalibrationStatus),
    itemModel: z.nativeEnum(DB.AdaptiveItemModel),
    itemRole: z.nativeEnum(DB.AdaptivePoolItemRole),
    score: z.number().finite(),
    correct: z.boolean(),
    responseCategory: z.array(z.number().int().nonnegative()).nullable(),
    elapsedSeconds: z.number().int().nonnegative().max(3_600).nullable(),
    administrationProbability: z.number().finite().gt(0).max(1),
    collectionDesignVersion: z.string().trim().min(1).max(160),
    isCalibrationAnchor: z.boolean(),
  })
  .strict()

export type AdaptiveValidationCriterion = z.infer<
  typeof adaptiveValidationCriterionSchema
>
export type AdaptiveValidationHoldoutRow = z.infer<
  typeof adaptiveValidationHoldoutRowSchema
>

export type AdaptiveValidationCalibration = Pick<
  DB.AdaptiveItemCalibration,
  | 'id'
  | 'assignmentId'
  | 'elementId'
  | 'elementVersion'
  | 'version'
  | 'model'
  | 'status'
  | 'discrimination'
  | 'difficulty'
  | 'guessing'
>

export type AdaptiveValidationConfidenceInterval = {
  lower: number
  upper: number
  confidenceLevel: 0.95
}

export type AdaptiveValidationMetrics = {
  exactAgreement: number
  adjacentAgreement: number
  meanAbsoluteLevelError: number
  capRate: number
  maximumExposure: number
  calibrationError: number
  logLoss: number
  exactAgreementInterval: AdaptiveValidationConfidenceInterval
  adjacentAgreementInterval: AdaptiveValidationConfidenceInterval
  capRateInterval: AdaptiveValidationConfidenceInterval
  maximumExposureInterval: AdaptiveValidationConfidenceInterval
}

export type AdaptiveValidationStratumMetrics = {
  key: string
  learnerCount: number
  metrics: AdaptiveValidationMetrics
}

type ValidationSubject = {
  criterion: AdaptiveValidationCriterion['subjects'][number]
  responses: AdaptiveScoredResponse[]
  assignmentIds: Set<number>
}

type EvaluatedSubject = {
  subjectPseudonym: string
  strata: string[]
  exact: boolean
  adjacent: boolean
  absoluteLevelError: number
  capped: boolean
  calibrationError: number
  logLoss: number
  assignmentIds: Set<number>
}

export function createAdaptiveValidationAccumulator({
  criterion,
  calibrations,
  expectedIdentity,
}: {
  criterion: AdaptiveValidationCriterion
  calibrations: readonly AdaptiveValidationCalibration[]
  expectedIdentity: {
    measurementVersion: DB.AdaptiveMeasurementVersion
    estimatorImplementationVersion: string
    classificationPolicyVersion: number
    calibrationPolicyVersion: number
  }
}) {
  const subjects = new Map<string, ValidationSubject>(
    criterion.subjects.map((entry) => [
      entry.subjectPseudonym,
      {
        criterion: entry,
        responses: [],
        assignmentIds: new Set<number>(),
      },
    ])
  )
  const calibrationById = new Map(
    calibrations.map((calibration) => [calibration.id, calibration])
  )

  return {
    add(rowInput: unknown) {
      const row = adaptiveValidationHoldoutRowSchema.parse(rowInput)
      const subject = subjects.get(row.subjectPseudonym)
      if (!subject) return
      if (
        row.measurementVersion !== expectedIdentity.measurementVersion ||
        row.estimatorImplementationVersion !==
          expectedIdentity.estimatorImplementationVersion ||
        row.classificationPolicyVersion !==
          expectedIdentity.classificationPolicyVersion ||
        row.calibrationPolicyVersion !==
          expectedIdentity.calibrationPolicyVersion
      ) {
        return
      }
      const calibration = calibrationById.get(row.calibrationId)
      if (!calibration || !matchesCalibration(row, calibration)) return
      if (
        row.itemRole !== DB.AdaptivePoolItemRole.SCORING &&
        row.itemRole !== DB.AdaptivePoolItemRole.ANCHOR
      ) {
        return
      }
      if (subject.assignmentIds.has(row.assignmentId)) {
        throw new Error('ADAPTIVE_VALIDATION_DUPLICATE_ITEM_EXPOSURE')
      }

      subject.assignmentIds.add(row.assignmentId)
      subject.responses.push({
        item: toScoredItem(row, calibration),
        correct: row.correct,
      })
    },
    evaluate({
      scale,
      approvedProbabilityThreshold,
      totalQuestionCap,
    }: {
      scale: AdaptiveScaleDefinition
      approvedProbabilityThreshold: number
      totalQuestionCap: number
    }) {
      return evaluateValidationSubjects({
        subjects: [...subjects.values()],
        scale,
        approvedProbabilityThreshold,
        totalQuestionCap,
      })
    },
  }
}

function matchesCalibration(
  row: AdaptiveValidationHoldoutRow,
  calibration: AdaptiveValidationCalibration
) {
  return (
    calibration.status === DB.AdaptiveItemCalibrationStatus.CALIBRATED &&
    row.calibrationStatus === DB.AdaptiveItemCalibrationStatus.CALIBRATED &&
    row.assignmentId === calibration.assignmentId &&
    row.elementId === calibration.elementId &&
    row.elementVersion === calibration.elementVersion &&
    row.calibrationVersion === calibration.version &&
    row.itemModel === calibration.model
  )
}

function toScoredItem(
  row: AdaptiveValidationHoldoutRow,
  calibration: AdaptiveValidationCalibration
): AdaptiveScoredItem {
  return {
    id: row.assignmentId,
    itemType: row.elementType as AdaptiveScoredItem['itemType'],
    choiceCount: inferChoiceCount(row.elementType, calibration.guessing),
    model: calibration.model,
    calibrationId: calibration.id,
    discrimination: calibration.discrimination,
    difficulty: calibration.difficulty,
    guessing: calibration.guessing,
  }
}

function inferChoiceCount(type: DB.ElementType, guessing: number) {
  if (type === DB.ElementType.KPRIM) return 4
  if (type === DB.ElementType.SC) return Math.round(1 / guessing)
  if (type === DB.ElementType.MC) return Math.round(Math.log2(1 / guessing + 1))
  return null
}

function evaluateValidationSubjects({
  subjects,
  scale,
  approvedProbabilityThreshold,
  totalQuestionCap,
}: {
  subjects: ValidationSubject[]
  scale: AdaptiveScaleDefinition
  approvedProbabilityThreshold: number
  totalQuestionCap: number
}) {
  const evaluated = subjects.map((subject) => {
    if (subject.responses.length === 0) {
      throw new Error('ADAPTIVE_VALIDATION_CRITERION_SUBJECT_MISSING')
    }
    const posterior = estimateEapPosterior({
      responses: subject.responses,
      scale,
      credibleMass: 0.8,
    })
    const orderedBands = posterior.bandProbabilities
      .map((band) => ({
        ...band,
        order: scale.levels.find((level) => level.id === band.levelId)?.order,
      }))
      .filter(
        (band): band is typeof band & { order: number } =>
          band.order !== undefined
      )
    const predicted = orderedBands.reduce((best, current) =>
      current.probability > best.probability ? current : best
    )
    const criterionBand = orderedBands.find(
      ({ order }) => order === subject.criterion.levelOrder
    )
    if (!criterionBand) {
      throw new Error('ADAPTIVE_VALIDATION_CRITERION_LEVEL_INVALID')
    }
    const classified = predicted.probability >= approvedProbabilityThreshold
    const exact = classified && predicted.order === subject.criterion.levelOrder
    const adjacent =
      classified &&
      Math.abs(predicted.order - subject.criterion.levelOrder) <= 1
    return {
      subjectPseudonym: subject.criterion.subjectPseudonym,
      strata: subject.criterion.strata,
      exact,
      adjacent,
      absoluteLevelError: Math.abs(
        predicted.order - subject.criterion.levelOrder
      ),
      capped: subject.responses.length >= totalQuestionCap,
      calibrationError: Math.abs(predicted.probability - (exact ? 1 : 0)),
      logLoss: -Math.log(
        Math.max(criterionBand.probability, MINIMUM_LOG_PROBABILITY)
      ),
      assignmentIds: subject.assignmentIds,
    } satisfies EvaluatedSubject
  })

  const stratumKeys = [
    ...new Set(evaluated.flatMap((subject) => subject.strata)),
  ].sort()
  const stratumMetrics = stratumKeys.map((key) => {
    const members = evaluated.filter((subject) => subject.strata.includes(key))
    return {
      key,
      learnerCount: members.length,
      metrics: summarizeValidationMetrics(members),
    }
  })
  return {
    aggregateMetrics: summarizeValidationMetrics(evaluated),
    stratumMetrics,
  }
}

function summarizeValidationMetrics(
  subjects: readonly EvaluatedSubject[]
): AdaptiveValidationMetrics {
  if (subjects.length === 0) {
    throw new Error('ADAPTIVE_VALIDATION_EMPTY_STRATUM')
  }
  const exactCount = subjects.filter(({ exact }) => exact).length
  const adjacentCount = subjects.filter(({ adjacent }) => adjacent).length
  const cappedCount = subjects.filter(({ capped }) => capped).length
  const exposures = new Map<number, number>()
  for (const subject of subjects) {
    for (const assignmentId of subject.assignmentIds) {
      exposures.set(assignmentId, (exposures.get(assignmentId) ?? 0) + 1)
    }
  }
  const maximumExposureCount = Math.max(0, ...exposures.values())
  return {
    exactAgreement: exactCount / subjects.length,
    adjacentAgreement: adjacentCount / subjects.length,
    meanAbsoluteLevelError: mean(
      subjects.map(({ absoluteLevelError }) => absoluteLevelError)
    ),
    capRate: cappedCount / subjects.length,
    maximumExposure: maximumExposureCount / subjects.length,
    calibrationError: mean(
      subjects.map(({ calibrationError }) => calibrationError)
    ),
    logLoss: mean(subjects.map(({ logLoss }) => logLoss)),
    exactAgreementInterval: wilson95(exactCount, subjects.length),
    adjacentAgreementInterval: wilson95(adjacentCount, subjects.length),
    capRateInterval: wilson95(cappedCount, subjects.length),
    maximumExposureInterval: wilson95(maximumExposureCount, subjects.length),
  }
}

export function adaptiveValidationGateFailures({
  aggregateMetrics,
  stratumMetrics,
}: {
  aggregateMetrics: AdaptiveValidationMetrics
  stratumMetrics: AdaptiveValidationStratumMetrics[]
}) {
  const failures: string[] = []
  if (aggregateMetrics.exactAgreementInterval.lower < 0.7) {
    failures.push('EXACT_AGREEMENT')
  }
  if (aggregateMetrics.adjacentAgreementInterval.lower < 0.95) {
    failures.push('ADJACENT_AGREEMENT')
  }
  if (aggregateMetrics.capRateInterval.upper > 0.9) {
    failures.push('CAP_RATE')
  }
  if (aggregateMetrics.maximumExposureInterval.upper > 0.4) {
    failures.push('MAXIMUM_EXPOSURE')
  }
  for (const stratum of stratumMetrics) {
    if (stratum.learnerCount < MINIMUM_VALIDATION_STRATUM_SIZE) {
      failures.push(`STRATUM_SIZE:${stratum.key}`)
    }
    if (stratum.metrics.adjacentAgreementInterval.lower < 0.9) {
      failures.push(`STRATUM_ADJACENT_AGREEMENT:${stratum.key}`)
    }
  }
  return failures
}

function wilson95(
  successes: number,
  total: number
): AdaptiveValidationConfidenceInterval {
  const proportion = successes / total
  const squared = WILSON_95_Z * WILSON_95_Z
  const denominator = 1 + squared / total
  const center = (proportion + squared / (2 * total)) / denominator
  const margin =
    (WILSON_95_Z / denominator) *
    Math.sqrt(
      (proportion * (1 - proportion)) / total + squared / (4 * total * total)
    )
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    confidenceLevel: 0.95,
  }
}

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
