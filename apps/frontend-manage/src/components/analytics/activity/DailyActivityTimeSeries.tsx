import { ParticipantActivityTimestamp } from '@klicker-uzh/graphql/dist/ops'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ActivityTimeSeriesPlot from './ActivityTimeSeriesPlot'

function DailyActivityTimeSeries({
  activity,
  courseParticipants,
}: {
  activity: ParticipantActivityTimestamp[]
  courseParticipants: number
}) {
  const t = useTranslations()

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.dailyStudentActivity')}</H2>
      {activity.length > 0 ? (
        <div className="flex w-full flex-col gap-3 lg:flex-row">
          <ActivityTimeSeriesPlot
            activityData={activity.map((item) => {
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
            })}
          />
        </div>
      ) : (
        <UserNotification
          message={t('manage.analytics.noDailyActivityData')}
          type="info"
        />
      )}
    </div>
  )
}

export default DailyActivityTimeSeries
