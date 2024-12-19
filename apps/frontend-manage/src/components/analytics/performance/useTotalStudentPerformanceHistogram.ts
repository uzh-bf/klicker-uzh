import { ParticipantPerformance } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import computeHistogramStatistics from '../computeHistogramStatistics'

function useTotalStudentPerformanceHistogram({
  participantPerformance,
}: {
  participantPerformance: ParticipantPerformance[]
}) {
  return useMemo(() => {
    const totalErrorRates = participantPerformance.map(
      (p) => p.totalErrorRate * 100
    )
    const histogram = new Array(101).fill(0)
    totalErrorRates.forEach((errorRate) => {
      histogram[Math.floor(errorRate)]++
    })
    const stats = computeHistogramStatistics(totalErrorRates)

    return histogram.map((count, errorRate) => ({
      errorRate: errorRate,
      count,
      color:
        errorRate < stats.q1
          ? 'rgba(0, 180, 0, 0.8)'
          : errorRate > stats.q3
            ? 'rgba(220, 0, 0, 0.8)'
            : '#FFD700',
      isQ1: errorRate === Math.floor(stats.q1),
      isQ3: errorRate === Math.floor(stats.q3),
      isMedian: errorRate === Math.floor(stats.median),
      isMean: errorRate === Math.floor(stats.mean),
    }))
  }, [participantPerformance])
}

export default useTotalStudentPerformanceHistogram
