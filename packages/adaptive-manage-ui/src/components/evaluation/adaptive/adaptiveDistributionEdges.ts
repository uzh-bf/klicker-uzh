export type AdaptiveDistributionBucketInput = {
  levelLabel: string
  levelOrder: number
  count: number
  determinedCount: number
  // Absent for older payloads: then every level counts as measurable.
  hasElements?: boolean | null
}

export type AdaptiveDistributionRow = {
  key: string
  levelLabel: string
  // 'belowRange'/'aboveRange': the level lies below the lowest (above the
  // highest) level with published elements.
  edge: 'none' | 'belowRange' | 'aboveRange'
  count: number
  determinedCount: number
}

/**
 * Cohort level rows in level order, one per level, matching the student
 * result: a level beyond the levels with published elements keeps its own
 * row ("Under A2") and is marked as outside that range.
 */
export function getAdaptiveDistributionRows(
  buckets: readonly AdaptiveDistributionBucketInput[]
): AdaptiveDistributionRow[] {
  const sorted = buckets.toSorted((a, b) => a.levelOrder - b.levelOrder)
  const measurable = sorted.filter((bucket) => bucket.hasElements !== false)
  const lowest = measurable[0]
  const highest = measurable.at(-1)
  return sorted.map((bucket) =>
    row(
      bucket,
      !lowest || !highest
        ? 'none'
        : bucket.levelOrder < lowest.levelOrder
          ? 'belowRange'
          : bucket.levelOrder > highest.levelOrder
            ? 'aboveRange'
            : 'none'
    )
  )
}

function row(
  bucket: AdaptiveDistributionBucketInput,
  edge: AdaptiveDistributionRow['edge']
): AdaptiveDistributionRow {
  return {
    key: String(bucket.levelOrder),
    levelLabel: bucket.levelLabel,
    edge,
    count: bucket.count,
    determinedCount: bucket.determinedCount,
  }
}
