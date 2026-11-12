import {
  getAdaptiveLevelColors,
  getAdaptiveLevelGroupEnds,
  hasAdaptiveLevelMarkerContrast,
  normalizeAdaptiveLevelColor,
} from '@klicker-uzh/adaptive-contract'
import type { CompetenceTreeForm, CompetenceTreeLevelForm } from './types'

export type LevelColorRow = {
  key: string
  label: string
  /** Lecturer override, or null when the default palette applies. */
  override: string | null
  /** Default palette color for this level (shared with the student views). */
  defaultColor: string
  /** Color shown to students. */
  color: string
  /** True when the next level belongs to another main-level group. */
  groupEnd: boolean
  lowContrast: boolean
}

function orderedLevels(levels: readonly CompetenceTreeLevelForm[]) {
  return levels.slice().sort((a, b) => a.order - b.order)
}

/** Default, effective color and contrast state per level, in level order. */
export function getLevelColorRows(
  levels: readonly CompetenceTreeLevelForm[]
): LevelColorRow[] {
  const ordered = orderedLevels(levels)
  const labels = ordered.map((level) => level.label)
  const overrides = ordered.map((level) => normalizedOverride(level.color))
  const defaults = getAdaptiveLevelColors(labels)
  const colors = getAdaptiveLevelColors(labels, overrides)
  const groupEnds = getAdaptiveLevelGroupEnds(ordered)
  return ordered.map((level, index) => ({
    key: level.key,
    label: level.label,
    override: overrides[index]!,
    defaultColor: defaults[index]!,
    color: colors[index]!,
    groupEnd: groupEnds[index]!,
    lowContrast:
      overrides[index] !== null &&
      !hasAdaptiveLevelMarkerContrast(colors[index]!),
  }))
}

function normalizedOverride(color: string | null | undefined) {
  const result = normalizeAdaptiveLevelColor(color)
  return result.valid ? result.color : null
}

/**
 * Sets (valid `#RRGGBB`) or clears (null/blank) the color of one level.
 * Invalid input leaves the form unchanged.
 */
export function setLevelColor(
  form: CompetenceTreeForm,
  levelKey: string,
  color: string | null
): CompetenceTreeForm {
  const result = normalizeAdaptiveLevelColor(color)
  if (!result.valid) return form
  return {
    ...form,
    levels: form.levels.map((level) =>
      level.key === levelKey ? { ...level, color: result.color } : level
    ),
  }
}

export function resetAllLevelColors(
  form: CompetenceTreeForm
): CompetenceTreeForm {
  return {
    ...form,
    levels: form.levels.map((level) => ({ ...level, color: null })),
  }
}

export function hasLevelColorOverrides(form: CompetenceTreeForm) {
  return form.levels.some((level) => normalizedOverride(level.color) !== null)
}
