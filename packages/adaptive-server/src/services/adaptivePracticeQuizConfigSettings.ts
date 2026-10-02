import { getAdaptivePresetDefaults } from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { AdaptivePracticeQuizConfigInput } from './adaptivePracticeQuizConfigTypes.js'
import type { AdaptiveConfiguredSettings } from './adaptivePracticeQuizReadiness.js'

export type ResolvedPresetSettings = AdaptiveConfiguredSettings & {
  minItemsPerCoverageCell: number
  preset: DB.AdaptivePracticeQuizPreset
  attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy
  levelMappingRule: DB.AdaptiveLevelMappingRule
  showTimer: boolean
  timeLimitSeconds: number | null
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
    topInformationRatio: isResearch
      ? (research?.topInformationRatio ?? defaults.topInformationRatio)
      : defaults.topInformationRatio,
    defaultDiscrimination: isResearch
      ? (research?.defaultDiscrimination ?? defaults.defaultDiscrimination)
      : defaults.defaultDiscrimination,
    showTimer: input.showTimer ?? defaults.showTimer,
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

function configurationError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}
