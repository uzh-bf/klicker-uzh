import { ParticipantActivityPerformances } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

function useStudentActivityPerformanceTableData({
  dataAvailable,
  performances,
  selectedActivities,
}: {
  dataAvailable: boolean
  performances: ParticipantActivityPerformances[]
  selectedActivities: string[]
}) {
  const t = useTranslations()

  return useMemo(() => {
    if (!dataAvailable) {
      return []
    }

    // map the performances to a data structure where every selected activity entry can be
    // identified through a direct key - {activityId}-totalScore and {activityId}-completion
    return performances.map((studentPerformance) =>
      studentPerformance.performances.reduce<Record<string, string | number>>(
        (acc, performance) => {
          if (selectedActivities.includes(performance.activityId)) {
            acc[`${performance.activityId}-totalScore`] = performance.totalScore
            acc[`${performance.activityId}-completion`] = Math.round(
              performance.completion * 100
            )
          }

          return acc
        },
        {
          participantUsername: studentPerformance.participantUsername,
          participantEmail:
            studentPerformance.participantEmail ??
            t('manage.analytics.emailMissing'),
        }
      )
    )
  }, [dataAvailable, performances, t, selectedActivities])
}

export default useStudentActivityPerformanceTableData
