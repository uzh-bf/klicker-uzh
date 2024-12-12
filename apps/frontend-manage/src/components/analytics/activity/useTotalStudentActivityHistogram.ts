import { ParticipantCourseActivity } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

// group the student activity data into bins for the histogram illustration
function groupHistogramBins(activeWeeks: number[], totalWeeks: number) {
  const histogram = new Array(totalWeeks + 1).fill(0)
  activeWeeks.forEach((weeks) => {
    histogram[weeks] = (histogram[weeks] || 0) + 1
  })
  return histogram
}

// compute illustration statistics for the histogram
const computeStatistics = (data: number[]) => {
  const sorted = [...data].sort((a, b) => a - b)
  const len = sorted.length

  return {
    q1: sorted[Math.floor(len * 0.25)],
    q3: sorted[Math.floor(len * 0.75)],
    median:
      len % 2 === 0
        ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
        : sorted[Math.floor(len / 2)],
    mean: data.reduce((a, b) => a + b, 0) / len,
  }
}

function useTotalStudentActivityHistogram({
  courseWeeks,
  participantActivity,
}: {
  courseWeeks: number
  participantActivity: ParticipantCourseActivity[]
}) {
  return useMemo(() => {
    const activeWeeks = participantActivity.map((p) => p.activeWeeks)
    const histogram = groupHistogramBins(activeWeeks, courseWeeks)
    const stats = computeStatistics(activeWeeks)

    return histogram.map((count, week) => ({
      week: week,
      count,
      color:
        week < stats.q1
          ? 'rgba(220, 0, 0, 0.8)'
          : week > stats.q3
            ? 'rgba(0, 180, 0, 0.8)'
            : '#FFD700',
      isQ1: week === Math.floor(stats.q1),
      isQ3: week === Math.floor(stats.q3),
      isMedian: week === Math.floor(stats.median),
      isMean: week === Math.floor(stats.mean),
    }))
  }, [participantActivity, courseWeeks])
}

export default useTotalStudentActivityHistogram
