import {
  getAdaptivePresetDefaults,
  isValidAdaptiveClassificationToleranceBands,
  isValidAdaptiveRetakeStartMaxAgeDays,
} from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { AdaptivePracticeQuizConfigInput } from './adaptivePracticeQuizConfigTypes.js'
import type { AdaptiveConfiguredSettings } from './adaptivePracticeQuizReadiness.js'

export type ResolvedPresetSettings = AdaptiveConfiguredSettings & {
  minItemsPerCoverageCell: number
  classificationToleranceBands: number
  preset: DB.AdaptivePracticeQuizPreset
  attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy
  levelMappingRule: DB.AdaptiveLevelMappingRule
  showTimer: boolean
  timeLimitSeconds: number | null
  retakeStartFromPreviousResult: boolean
  retakeStartMaxAgeDays: number
  retakePreferNewQuestions: boolean
}

export function resolvePresetSettings(
  input: AdaptivePracticeQuizConfigInput,
  treeDefaults: {
    defaultDiscrimination: number
    defaultTotalQuestionCap: number
    defaultTimeLimitSeconds: number | null
  }
): ResolvedPresetSettings {
  const pilot =
    Boolean(input.scaleVersionId) &&
    input.preset === DB.AdaptivePracticeQuizPreset.PLACEMENT
  const research = input.researchSettings
  const isResearch = input.preset === DB.AdaptivePracticeQuizPreset.RESEARCH
  const defaults = getAdaptivePresetDefaults(input.preset, {
    treeDefaultDiscrimination: treeDefaults.defaultDiscrimination,
  })
  const timeLimitSeconds =
    typeof input.timeLimitSeconds === 'undefined'
      ? treeDefaults.defaultTimeLimitSeconds
      : input.timeLimitSeconds
  if (
    timeLimitSeconds !== null &&
    (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 1)
  ) {
    throw configurationError(
      'Time limit must be a positive number of seconds.',
      'ADAPTIVE_TIME_LIMIT_INVALID'
    )
  }

  const classificationToleranceBands =
    input.classificationToleranceBands ?? defaults.classificationToleranceBands
  if (
    !isValidAdaptiveClassificationToleranceBands(classificationToleranceBands)
  ) {
    throw configurationError(
      'Classification precision must be a whole number of levels from 0 to 5.',
      'ADAPTIVE_CLASSIFICATION_TOLERANCE_INVALID'
    )
  }

  const retakeStartMaxAgeDays =
    input.retakeStartMaxAgeDays ?? defaults.retakeStartMaxAgeDays
  if (!isValidAdaptiveRetakeStartMaxAgeDays(retakeStartMaxAgeDays)) {
    throw configurationError(
      'The age limit of the previous result must be a whole number of days from 1 to 365.',
      'ADAPTIVE_RETAKE_START_MAX_AGE_INVALID'
    )
  }

  return {
    preset: input.preset,
    rootBalancedPlacement: pilot,
    attemptSelectionPolicy: isResearch
      ? (research?.attemptSelectionPolicy ?? defaults.attemptSelectionPolicy)
      : defaults.attemptSelectionPolicy,
    levelMappingRule: pilot
      ? DB.AdaptiveLevelMappingRule.NEAREST
      : isResearch
        ? (research?.levelMappingRule ?? defaults.levelMappingRule)
        : defaults.levelMappingRule,
    totalQuestionCap:
      input.totalQuestionCap ?? treeDefaults.defaultTotalQuestionCap,
    timeLimitSeconds,
    perLeafQuestionCap: input.perLeafQuestionCap ?? defaults.perLeafQuestionCap,
    minQuestionsPerLeaf:
      input.minQuestionsPerLeaf ?? (pilot ? 1 : defaults.minQuestionsPerLeaf),
    minItemsPerCoverageCell:
      input.minItemsPerCoverageCell ?? defaults.minItemsPerCoverageCell,
    classificationZ: input.classificationZ ?? defaults.classificationZ,
    classificationToleranceBands,
    topInformationRatio: isResearch
      ? (research?.topInformationRatio ?? defaults.topInformationRatio)
      : defaults.topInformationRatio,
    defaultDiscrimination: isResearch
      ? (research?.defaultDiscrimination ?? defaults.defaultDiscrimination)
      : defaults.defaultDiscrimination,
    showTimer: input.showTimer ?? defaults.showTimer,
    retakeStartFromPreviousResult:
      input.retakeStartFromPreviousResult ??
      defaults.retakeStartFromPreviousResult,
    retakeStartMaxAgeDays,
    retakePreferNewQuestions:
      input.retakePreferNewQuestions ?? defaults.retakePreferNewQuestions,
  }
}

export function assertPlacementPilotSettings(
  config: {
    scaleVersionId?: string | null
    preset: DB.AdaptivePracticeQuizPreset
    measurementVersion?: DB.AdaptiveMeasurementVersion
  },
  settings: ResolvedPresetSettings
) {
  if (
    !config.scaleVersionId ||
    config.preset !== DB.AdaptivePracticeQuizPreset.PLACEMENT ||
    (config.measurementVersion !== undefined &&
      config.measurementVersion !==
        DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1)
  )
    return
  if (settings.perLeafQuestionCap !== null) {
    throw configurationError(
      'Focused root-balanced placement does not support a per-subcompetence cap.',
      'ADAPTIVE_PLACEMENT_PILOT_LIMITS_INVALID'
    )
  }
}

/**
 * The tolerance is an IRT_V1 engine setting (Catalyst SEQUENTIAL_ROOTS_V6);
 * IRT v2 classification is posterior-probability based and rejects it.
 */
export function assertClassificationToleranceSupported(
  measurementVersion: DB.AdaptiveMeasurementVersion,
  settings: Pick<ResolvedPresetSettings, 'classificationToleranceBands'>
) {
  if (
    settings.classificationToleranceBands > 0 &&
    measurementVersion !== DB.AdaptiveMeasurementVersion.IRT_V1
  ) {
    throw configurationError(
      'Classification precision is only available for IRT v1 quizzes.',
      'ADAPTIVE_CLASSIFICATION_TOLERANCE_UNSUPPORTED'
    )
  }
}

function configurationError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}
