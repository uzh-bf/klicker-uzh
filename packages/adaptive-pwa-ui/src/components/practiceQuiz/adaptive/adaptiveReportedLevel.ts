export type AdaptiveReportedLevelBand = {
  label: string
  order: number
  // Absent for older payloads: then every band counts as measurable.
  hasElements?: boolean | null
}

export type AdaptiveReportedLevelLabel = {
  key:
    | 'pwa.practiceQuiz.adaptive.profile.levelExact'
    | 'pwa.practiceQuiz.adaptive.profile.levelWithTolerance'
    | 'pwa.practiceQuiz.adaptive.profile.levelBelowRange'
    | 'pwa.practiceQuiz.adaptive.profile.levelAboveRange'
  values: { level: string; count?: number }
}

/**
 * Presentation of a reported (or rough) level label. Never changes the
 * classification itself.
 *
 * - Bottom/top edge: when bands below the lowest (or above the highest) band
 *   with published elements exist and the level is at or beyond that band,
 *   the result cannot tell how far below/above it lies, so it reads
 *   "A2.1 or below (below the measurable range)" instead of naming an
 *   unmeasured band such as "Under A2".
 * - Tolerance: a classified level under a quiz tolerance of t > 0 bands reads
 *   "B1.2 (±1 level)".
 */
export function getAdaptiveReportedLevelLabel({
  levelLabel,
  levelBands,
  toleranceBands = 0,
  classified,
}: {
  levelLabel: string
  levelBands: readonly AdaptiveReportedLevelBand[]
  toleranceBands?: number | null
  classified: boolean
}): AdaptiveReportedLevelLabel {
  const bands = levelBands.slice().sort((a, b) => a.order - b.order)
  const level = bands.find((band) => band.label === levelLabel)
  const measurable = bands.filter((band) => band.hasElements !== false)
  const lowest = measurable[0]
  const highest = measurable.at(-1)
  if (level && lowest && highest) {
    if (bands[0]!.order < lowest.order && level.order <= lowest.order) {
      return {
        key: 'pwa.practiceQuiz.adaptive.profile.levelBelowRange',
        values: { level: lowest.label },
      }
    }
    if (bands.at(-1)!.order > highest.order && level.order >= highest.order) {
      return {
        key: 'pwa.practiceQuiz.adaptive.profile.levelAboveRange',
        values: { level: highest.label },
      }
    }
  }
  if (classified && toleranceBands && toleranceBands > 0) {
    return {
      key: 'pwa.practiceQuiz.adaptive.profile.levelWithTolerance',
      values: { level: levelLabel, count: toleranceBands },
    }
  }
  return {
    key: 'pwa.practiceQuiz.adaptive.profile.levelExact',
    values: { level: levelLabel },
  }
}
