import type {
  CompetenceTreeAssignmentForm,
  CompetenceTreeCoverageForm,
  CompetenceTreeForm,
} from './types'

// Matches the default target of coverage cells that have not been saved yet.
export const DEFAULT_COVERAGE_TARGET_ITEM_COUNT = 5

export type CoverageBulkAction =
  | { type: 'switchOffEmpty' }
  | { type: 'switchOffBelow'; minimum: number }
  | { type: 'switchOnAll' }

export interface CoverageCellKey {
  leafKey: string
  levelKey: string
}

export interface CoverageBulkPlan {
  enabled: boolean
  cells: CoverageCellKey[]
  /** Enabled assignments whose primary cell is switched off. */
  disabledAssignmentKeys: string[]
  /** Enabled assignments that also count for a switched-off cell. */
  removedAdditionalLinks: { assignmentKey: string; leafKey: string }[]
  /** Leaves left unchanged because no enabled level would remain. */
  skippedLeafKeys: string[]
}

export function coverageCellId(leafKey: string, levelKey: string) {
  return `${leafKey}\u0000${levelKey}`
}

/** Enabled assignments per leaf × level cell, including additional leaves. */
export function countEnabledAssignmentsByCell(
  assignments: readonly CompetenceTreeAssignmentForm[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const assignment of assignments) {
    if (!assignment.enabled) continue
    for (const leafKey of new Set([
      assignment.leafKey,
      ...assignment.additionalLeafKeys,
    ])) {
      const id = coverageCellId(leafKey, assignment.levelKey)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

export function getCoverageCell(
  coverages: readonly CompetenceTreeCoverageForm[],
  leafKey: string,
  levelKey: string
): CompetenceTreeCoverageForm {
  return (
    coverages.find(
      (coverage) =>
        coverage.leafKey === leafKey && coverage.levelKey === levelKey
    ) ?? {
      leafKey,
      levelKey,
      targetItemCount: DEFAULT_COVERAGE_TARGET_ITEM_COUNT,
      enabled: true,
    }
  )
}

/**
 * Selects the cells of the given leaves that a bulk action changes. Switching
 * off keeps the tree saveable: a leaf never loses its last enabled level, and
 * enabled assignments in switched-off cells are disabled (primary cell) or no
 * longer also count for that cell (additional leaf).
 */
export function planCoverageBulkAction(
  form: CompetenceTreeForm,
  leafKeys: readonly string[],
  action: CoverageBulkAction
): CoverageBulkPlan {
  const levelKeys = form.levels
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((level) => level.key)
  // The first entry wins, matching how the matrix resolves a cell.
  const coverageById = new Map<string, CompetenceTreeCoverageForm>()
  for (const coverage of form.coverages) {
    const id = coverageCellId(coverage.leafKey, coverage.levelKey)
    if (!coverageById.has(id)) coverageById.set(id, coverage)
  }
  const isEnabled = (leafKey: string, levelKey: string) =>
    coverageById.get(coverageCellId(leafKey, levelKey))?.enabled ?? true

  const plan: CoverageBulkPlan = {
    enabled: action.type === 'switchOnAll',
    cells: [],
    disabledAssignmentKeys: [],
    removedAdditionalLinks: [],
    skippedLeafKeys: [],
  }

  if (action.type === 'switchOnAll') {
    for (const leafKey of leafKeys) {
      for (const levelKey of levelKeys) {
        if (!isEnabled(leafKey, levelKey))
          plan.cells.push({ leafKey, levelKey })
      }
    }
    return plan
  }

  const minimum = action.type === 'switchOffEmpty' ? 1 : action.minimum
  const counts = countEnabledAssignmentsByCell(form.assignments)

  for (const leafKey of leafKeys) {
    const enabledLevelKeys = levelKeys.filter((levelKey) =>
      isEnabled(leafKey, levelKey)
    )
    const selected = enabledLevelKeys.filter(
      (levelKey) =>
        (counts.get(coverageCellId(leafKey, levelKey)) ?? 0) < minimum
    )
    if (selected.length === 0) continue
    if (selected.length === enabledLevelKeys.length) {
      plan.skippedLeafKeys.push(leafKey)
      continue
    }
    for (const levelKey of selected) plan.cells.push({ leafKey, levelKey })
  }

  const switchedOff = new Set(
    plan.cells.map(({ leafKey, levelKey }) => coverageCellId(leafKey, levelKey))
  )
  for (const assignment of form.assignments) {
    if (!assignment.enabled) continue
    if (
      switchedOff.has(coverageCellId(assignment.leafKey, assignment.levelKey))
    ) {
      plan.disabledAssignmentKeys.push(assignment.key)
      continue
    }
    for (const leafKey of assignment.additionalLeafKeys) {
      if (switchedOff.has(coverageCellId(leafKey, assignment.levelKey))) {
        plan.removedAdditionalLinks.push({
          assignmentKey: assignment.key,
          leafKey,
        })
      }
    }
  }

  return plan
}

export function applyCoverageBulkPlan(
  form: CompetenceTreeForm,
  plan: CoverageBulkPlan
): CompetenceTreeForm {
  if (plan.cells.length === 0) return form

  const selected = new Map(
    plan.cells.map((cell) => [
      coverageCellId(cell.leafKey, cell.levelKey),
      cell,
    ])
  )
  const existing = new Set<string>()
  const coverages = form.coverages.map((coverage) => {
    const id = coverageCellId(coverage.leafKey, coverage.levelKey)
    if (!selected.has(id)) return coverage
    existing.add(id)
    return { ...coverage, enabled: plan.enabled }
  })
  for (const [id, { leafKey, levelKey }] of selected) {
    if (existing.has(id)) continue
    coverages.push({
      leafKey,
      levelKey,
      targetItemCount: DEFAULT_COVERAGE_TARGET_ITEM_COUNT,
      enabled: plan.enabled,
    })
  }

  const disabledKeys = new Set(plan.disabledAssignmentKeys)
  const removedLinks = new Map<string, Set<string>>()
  for (const { assignmentKey, leafKey } of plan.removedAdditionalLinks) {
    const leaves = removedLinks.get(assignmentKey) ?? new Set<string>()
    leaves.add(leafKey)
    removedLinks.set(assignmentKey, leaves)
  }
  const assignments =
    disabledKeys.size === 0 && removedLinks.size === 0
      ? form.assignments
      : form.assignments.map((assignment) => {
          if (disabledKeys.has(assignment.key)) {
            return { ...assignment, enabled: false }
          }
          const removed = removedLinks.get(assignment.key)
          if (!removed) return assignment
          return {
            ...assignment,
            additionalLeafKeys: assignment.additionalLeafKeys.filter(
              (leafKey) => !removed.has(leafKey)
            ),
          }
        })

  return { ...form, coverages, assignments }
}
