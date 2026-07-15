export type AssessmentReportHistogramBin = {
  binStart: number
  binEnd: number
}

export function isScoreInHistogramBin({
  score,
  bin,
  isLast,
}: {
  score: number
  bin: AssessmentReportHistogramBin
  isLast: boolean
}) {
  return (
    score >= bin.binStart && (isLast ? score <= bin.binEnd : score < bin.binEnd)
  )
}

export function getHistogramBinGeometry(
  histogram: AssessmentReportHistogramBin[],
  index: number
) {
  const first = histogram[0]
  const last = histogram.at(-1)
  const bin = histogram[index]
  if (!first || !last || !bin) return { startRatio: 0, widthRatio: 0 }

  const totalRange = last.binEnd - first.binStart
  if (totalRange <= 0) {
    const fallbackWidth = 1 / histogram.length
    return { startRatio: index * fallbackWidth, widthRatio: fallbackWidth }
  }

  return {
    startRatio: (bin.binStart - first.binStart) / totalRange,
    widthRatio: (bin.binEnd - bin.binStart) / totalRange,
  }
}
