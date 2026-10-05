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
  // 'belowRange'/'aboveRange': the row also holds the buckets beyond the
  // lowest/highest level with published elements ("A2.1 or below").
  edge: 'none' | 'belowRange' | 'aboveRange'
  count: number
  determinedCount: number
}

/**
 * Cohort level rows with the unmeasured edge levels folded into the nearest
 * measurable level, matching the student result ("A2.1 or below"). A level
 * without published elements can hold estimates only because the scale
 * extends beyond the pool; it is not a measured level of its own.
 */
export function getAdaptiveDistributionRows(
  buckets: readonly AdaptiveDistributionBucketInput[]
): AdaptiveDistributionRow[] {
  const sorted = buckets.toSorted((a, b) => a.levelOrder - b.levelOrder)
  const measurable = sorted.filter((bucket) => bucket.hasElements !== false)
  const lowest = measurable[0]
  const highest = measurable.at(-1)
  if (!lowest || !highest) {
    return sorted.map((bucket) => row(bucket, 'none'))
  }
  const below = sorted.filter((bucket) => bucket.levelOrder < lowest.levelOrder)
  const above = sorted.filter(
    (bucket) => bucket.levelOrder > highest.levelOrder
  )
  return sorted
    .filter(
      (bucket) =>
        bucket.levelOrder >= lowest.levelOrder &&
        bucket.levelOrder <= highest.levelOrder
    )
    .map((bucket) => {
      const merged = [bucket]
      let edge: AdaptiveDistributionRow['edge'] = 'none'
      if (bucket === lowest && below.length > 0) {
        merged.push(...below)
        edge = 'belowRange'
      }
      if (bucket === highest && above.length > 0) {
        merged.push(...above)
        edge = edge === 'none' ? 'aboveRange' : edge
      }
      return {
        key: String(bucket.levelOrder),
        levelLabel: bucket.levelLabel,
        edge,
        count: merged.reduce((sum, item) => sum + item.count, 0),
        determinedCount: merged.reduce(
          (sum, item) => sum + item.determinedCount,
          0
        ),
      }
    })
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
