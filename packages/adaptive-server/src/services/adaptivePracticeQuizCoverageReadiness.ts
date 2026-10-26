import {
  MAX_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL,
  MIN_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL,
  MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL,
} from '@klicker-uzh/adaptive-contract'
import type {
  AdaptiveConfiguredAssignment,
  AdaptiveConfiguredCoverage,
  AdaptiveConfiguredSettings,
  AdaptiveCoverageReadiness,
  AdaptiveReadinessIssue,
} from './adaptivePracticeQuizReadinessTypes.js'

type CoverageCellMinimumSettings = Pick<
  AdaptiveConfiguredSettings,
  'minItemsPerCoverageCell'
>

export function resolveCoverageCellMinimum(
  settings: CoverageCellMinimumSettings
): number {
  return settings.minItemsPerCoverageCell ?? MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL
}

/**
 * Product presets require the configured minimum in every enabled leaf × level
 * cell. Research and root-balanced placement only require a non-empty cell.
 */
export function resolveRequiredItemsPerCoverageCell(
  settings: CoverageCellMinimumSettings,
  strictProductReadiness: boolean
): number {
  return strictProductReadiness ? resolveCoverageCellMinimum(settings) : 1
}

export function validateCoverageCellMinimumSetting(
  settings: CoverageCellMinimumSettings
): AdaptiveReadinessIssue[] {
  const value = settings.minItemsPerCoverageCell
  if (
    value === undefined ||
    (Number.isInteger(value) &&
      value >= MIN_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL &&
      value <= MAX_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL)
  ) {
    return []
  }
  return [
    {
      code: 'ADAPTIVE_COVERAGE_CELL_MINIMUM_INVALID',
      message: `minItemsPerCoverageCell must be an integer between ${MIN_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL} and ${MAX_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL}.`,
      parameters: {
        field: 'minItemsPerCoverageCell',
        minimumValue: MIN_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL,
        maximumValue: MAX_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL,
      },
      path: 'minItemsPerCoverageCell',
    },
  ]
}

/**
 * Advisory only: a lowered cell minimum keeps fine-grained trees publishable,
 * but fewer independent elements per cell weaken item exposure control.
 * `minimumValue` carries the configured and `maximumValue` the recommended
 * minimum so the existing issue-parameter contract can render it.
 */
export function adviseCoverageCellMinimum(
  settings: CoverageCellMinimumSettings,
  strictProductReadiness: boolean
): AdaptiveReadinessIssue | null {
  const configured = resolveCoverageCellMinimum(settings)
  if (
    !strictProductReadiness ||
    configured >= MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL
  ) {
    return null
  }
  return {
    code: 'ADAPTIVE_COVERAGE_MINIMUM_BELOW_RECOMMENDED',
    message: `Each enabled leaf-level cell requires only ${configured} enabled element${configured === 1 ? '' : 's'}; ${MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL} are recommended.`,
    parameters: {
      field: 'minItemsPerCoverageCell',
      minimumValue: configured,
      maximumValue: MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL,
    },
    path: 'minItemsPerCoverageCell',
  }
}

export function evaluateAdaptiveCoverageReadiness({
  coverages,
  enabledLeafIds,
  assignmentsByCell,
  requiredItemCount,
}: {
  coverages: AdaptiveConfiguredCoverage[]
  enabledLeafIds: ReadonlySet<number>
  assignmentsByCell: ReadonlyMap<string, AdaptiveConfiguredAssignment[]>
  requiredItemCount: number
}): {
  coverages: AdaptiveCoverageReadiness[]
  errors: AdaptiveReadinessIssue[]
  warnings: AdaptiveReadinessIssue[]
} {
  const coverageReadiness: AdaptiveCoverageReadiness[] = []
  const errors: AdaptiveReadinessIssue[] = []
  const warnings: AdaptiveReadinessIssue[] = []

  for (const coverage of coverages) {
    if (!coverage.enabled || !enabledLeafIds.has(coverage.leafNodeId)) continue

    const enabledAssignmentCount =
      assignmentsByCell.get(`${coverage.leafNodeId}:${coverage.levelId}`)
        ?.length ?? 0
    const ready = enabledAssignmentCount >= requiredItemCount
    coverageReadiness.push({
      coverageId: coverage.id,
      leafNodeId: coverage.leafNodeId,
      levelId: coverage.levelId,
      targetItemCount: coverage.targetItemCount,
      enabledAssignmentCount,
      ready,
    })

    if (enabledAssignmentCount === 0) {
      errors.push({
        code: 'ADAPTIVE_COVERAGE_CELL_EMPTY',
        message:
          'Every enabled leaf-level coverage cell needs at least one enabled element.',
        parameters: {},
        path: `coverages.${coverage.id}`,
        leafNodeId: coverage.leafNodeId,
        levelId: coverage.levelId,
      })
    } else if (!ready) {
      errors.push({
        code: 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM',
        message: `This quiz requires at least ${requiredItemCount} independent, enabled, scorable elements in every enabled leaf-level cell; this cell has ${enabledAssignmentCount}.`,
        parameters: {
          minimumValue: requiredItemCount,
          enabledAssignmentCount,
        },
        path: `coverages.${coverage.id}`,
        leafNodeId: coverage.leafNodeId,
        levelId: coverage.levelId,
      })
    } else if (enabledAssignmentCount < coverage.targetItemCount) {
      warnings.push({
        code: 'ADAPTIVE_COVERAGE_BELOW_TARGET',
        message: `Coverage target is ${coverage.targetItemCount}, but only ${enabledAssignmentCount} enabled element${enabledAssignmentCount === 1 ? '' : 's'} are available.`,
        parameters: {
          targetItemCount: coverage.targetItemCount,
          enabledAssignmentCount,
        },
        path: `coverages.${coverage.id}`,
        leafNodeId: coverage.leafNodeId,
        levelId: coverage.levelId,
      })
    }
  }

  return { coverages: coverageReadiness, errors, warnings }
}
