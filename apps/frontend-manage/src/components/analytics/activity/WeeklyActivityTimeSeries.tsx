import { useQuery } from '@apollo/client'
import {
  GetCourseWeeklyActivityDocument,
  ParticipantActivityTimestamp,
} from '@klicker-uzh/graphql/dist/ops'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import ActivityTimeSeriesPlot from './ActivityTimeSeriesPlot'
import SuspendedCourseComparison from './SuspendedCourseComparison'

function WeeklyActivityTimeSeries({
  activity,
  courseName,
  courseParticipants,
}: {
  activity: ParticipantActivityTimestamp[]
  courseName: string
  courseParticipants: number
}) {
  const t = useTranslations()
  const [courseComparison, setCourseComparison] = useState<
    { id: string; name: string } | undefined
  >(undefined)

  const { data, loading } = useQuery(GetCourseWeeklyActivityDocument, {
    variables: { courseId: courseComparison?.id },
    skip: typeof courseComparison === 'undefined',
    fetchPolicy: 'network-only',
  })
  const secondParticipants =
    data?.getCourseWeeklyActivity?.totalParticipants ?? 0
  const secondActivity = data?.getCourseWeeklyActivity?.weeklyActivity ?? []

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.weeklyStudentActivity')}</H2>
      {activity.length > 0 ? (
        <div className="flex w-full flex-col gap-3 lg:flex-row">
          <div className="w-full lg:w-3/4">
            <ActivityTimeSeriesPlot
              singleCourse={typeof courseComparison === 'undefined'}
              activityData={
                typeof courseComparison !== 'undefined' &&
                secondParticipants > 0
                  ? activity.map((item, idx) => ({
                      date: t('manage.analytics.weekN', { number: idx + 1 }),
                      activeParticipants:
                        (item.activeParticipants / courseParticipants) * 100,
                      activeParticipantsReference:
                        secondActivity.length > idx
                          ? (secondActivity[idx].activeParticipants /
                              secondParticipants) *
                            100
                          : undefined,
                    }))
                  : activity.map((item) => {
                      const date = new Date(item.date)
                      return {
                        date: date
                          .toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                          .replace(/\//g, '-'),
                        activeParticipants:
                          (item.activeParticipants / courseParticipants) * 100,
                      }
                    })
              }
              currentCourse={courseName}
              comparisonCourse={courseComparison?.name}
            />
          </div>
          <Suspense>
            <SuspendedCourseComparison
              courseComparison={courseComparison}
              setCourseComparison={setCourseComparison}
              comparisonCourseLoading={loading}
            />
          </Suspense>
        </div>
      ) : (
        <UserNotification
          message={t('manage.analytics.noWeeklyActivityData')}
          type="info"
        />
      )}
    </div>
  )
}

export default WeeklyActivityTimeSeries
