import {
  DEFAULT_DISCRIMINATION,
  MAX_ABSOLUTE_THETA,
  MAX_DISCRIMINATION,
  SUPPORTED_ADAPTIVE_ITEM_TYPES,
  deriveGuessingParameter,
  type AdaptiveItemType,
} from './core.js'

export type AdaptiveCalibrationStatus =
  | 'PROVISIONAL'
  | 'PILOT'
  | 'CALIBRATED'
  | 'FLAGGED'
  | 'RETIRED'

export type AdaptiveItemModel = 'TWO_PL' | 'THREE_PL_FIXED_C'

export type AdaptiveItemCalibration = {
  id: string
  status: AdaptiveCalibrationStatus
  model: AdaptiveItemModel
  discrimination: number
  difficulty: number
  guessing: number
  elementVersion: number
}

export type EffectiveAdaptiveItemParameters = {
  model: AdaptiveItemModel
  discrimination: number
  difficulty: number
  guessing: number
  contributesToDiagnosticEstimate: boolean
}

const CALIBRATION_STATUSES = new Set<AdaptiveCalibrationStatus>([
  'PROVISIONAL',
  'PILOT',
  'CALIBRATED',
  'FLAGGED',
  'RETIRED',
])

export function resolveEffectiveItemParameters({
  calibration,
  elementVersion,
  provisionalDifficulty,
  provisionalDiscrimination = DEFAULT_DISCRIMINATION,
  itemType,
  choiceCount,
}: {
  calibration: AdaptiveItemCalibration | null
  elementVersion: number
  provisionalDifficulty: number
  provisionalDiscrimination?: number
  itemType: AdaptiveItemType
  choiceCount?: number | null
}): EffectiveAdaptiveItemParameters {
  assertElementVersion(elementVersion, 'Published element version')
  assertDifficulty(provisionalDifficulty, 'Provisional difficulty')
  assertDiscrimination(provisionalDiscrimination, 'Provisional discrimination')
  assertItemType(itemType)
  assertChoiceCount(itemType, choiceCount)

  const expectedModel = modelForItemType(itemType)
  const expectedGuessing = deriveGuessingParameter({
    type: itemType,
    choiceCount,
  })
  assertGuessing(expectedGuessing, 'Item-type guessing')
  const provisional: EffectiveAdaptiveItemParameters = {
    model: expectedModel,
    discrimination: provisionalDiscrimination,
    difficulty: provisionalDifficulty,
    guessing: expectedGuessing,
    contributesToDiagnosticEstimate: false,
  }

  if (calibration === null) return provisional

  assertCalibration(
    calibration,
    elementVersion,
    expectedModel,
    expectedGuessing
  )
  if (calibration.status !== 'CALIBRATED') return provisional

  return {
    model: calibration.model,
    discrimination: calibration.discrimination,
    difficulty: calibration.difficulty,
    guessing: calibration.guessing,
    contributesToDiagnosticEstimate: true,
  }
}

function assertCalibration(
  calibration: AdaptiveItemCalibration,
  expectedElementVersion: number,
  expectedModel: AdaptiveItemModel,
  expectedGuessing: number
) {
  if (calibration.id.trim().length === 0) {
    throw new TypeError('Calibration ID must not be empty.')
  }
  if (!CALIBRATION_STATUSES.has(calibration.status)) {
    throw new TypeError('Calibration status is not supported.')
  }
  assertDiscrimination(calibration.discrimination, 'Calibration discrimination')
  assertDifficulty(calibration.difficulty, 'Calibration difficulty')
  assertGuessing(calibration.guessing, 'Calibration guessing')
  assertElementVersion(
    calibration.elementVersion,
    'Calibration element version'
  )
  if (calibration.elementVersion !== expectedElementVersion) {
    throw new TypeError(
      'Calibration element version must match the published element version.'
    )
  }
  if (calibration.model !== expectedModel) {
    throw new TypeError('Calibration model is incompatible with the item type.')
  }
  if (calibration.guessing !== expectedGuessing) {
    throw new TypeError(
      'Calibration guessing must match the item-type guessing parameter.'
    )
  }
}

function assertChoiceCount(
  itemType: AdaptiveItemType,
  choiceCount: number | null | undefined
) {
  if (itemType !== 'SC' && itemType !== 'MC' && itemType !== 'KPRIM') return

  if (!Number.isInteger(choiceCount) || (choiceCount ?? 0) < 2) {
    throw new TypeError(
      'Choice count is required and must be an integer of at least 2 for choice items.'
    )
  }
  if (itemType === 'KPRIM' && choiceCount !== 4) {
    throw new TypeError('KPRIM items must contain exactly 4 statements.')
  }
}

function assertItemType(itemType: AdaptiveItemType) {
  if (!SUPPORTED_ADAPTIVE_ITEM_TYPES.includes(itemType)) {
    throw new TypeError('Adaptive item type is not supported.')
  }
}

function modelForItemType(itemType: AdaptiveItemType): AdaptiveItemModel {
  return itemType === 'NUMERICAL' || itemType === 'FREE_TEXT'
    ? 'TWO_PL'
    : 'THREE_PL_FIXED_C'
}

function assertDiscrimination(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_DISCRIMINATION) {
    throw new TypeError(
      `${label} must be finite, positive, and at most ${MAX_DISCRIMINATION}.`
    )
  }
}

function assertDifficulty(value: number, label: string) {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_ABSOLUTE_THETA) {
    throw new TypeError(
      `${label} must be finite and within +/-${MAX_ABSOLUTE_THETA}.`
    )
  }
}

function assertGuessing(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new TypeError(
      `${label} must be finite and at least 0 but less than 1.`
    )
  }
}

function assertElementVersion(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer.`)
  }
}
