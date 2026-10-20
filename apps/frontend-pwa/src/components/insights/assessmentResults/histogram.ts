export type AssessmentReportHistogramBin = {
  binStart: number
  binEnd: number
}

export function isScoreInHistogramBin({
  score,
  bin,
  isLast,
  availableTotalPoints,
}: {
  score: number
  bin: AssessmentReportHistogramBin
  isLast: boolean
  // Bonus points can push a score above the available total, which would
  // otherwise fall outside every bin and highlight none of them.
  availableTotalPoints?: number
}) {
  const clampedScore =
    availableTotalPoints === undefined
      ? score
      : Math.min(Math.max(score, 0), availableTotalPoints)
  return (
    clampedScore >= bin.binStart &&
    (isLast ? clampedScore <= bin.binEnd : clampedScore < bin.binEnd)
  )
}

export function getHistogramBinGeometry(
  histogram: AssessmentReportHistogramBin[],
  index: number
) {
  if (!histogram[index]) return { startRatio: 0, widthRatio: 0 }

  // Bins are categorical privacy-preserving groups, not a continuous scale.
  // Equal slots keep a wide numeric range from making one bar visually tiny.
  const slotWidth = 1 / histogram.length
  return { startRatio: index * slotWidth, widthRatio: slotWidth }
}
