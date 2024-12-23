import { ParticipantCourseActivity } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import computeHistogramStatistics from '../computeHistogramStatistics'

// group the student activity data into bins for the histogram illustration
function groupStudentActivityBins(activeWeeks: number[], totalWeeks: number) {
  const histogram = new Array(totalWeeks + 1).fill(0)
  activeWeeks.forEach((weeks) => {
    histogram[weeks] = (histogram[weeks] || 0) + 1
  })
  return histogram
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
    const histogram = groupStudentActivityBins(activeWeeks, courseWeeks)
    const stats = computeHistogramStatistics(activeWeeks)

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
