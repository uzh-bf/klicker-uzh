import { WeekdayActivityAnalytics } from '@klicker-uzh/graphql/dist/ops'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function DailyActivityPlot({
  courseParticipants,
  activeDays,
}: {
  courseParticipants: number
  activeDays: WeekdayActivityAnalytics
}) {
  const t = useTranslations()
  const barChartData = [
    {
      weekday: t('shared.generic.monday'),
      value: (activeDays.monday / courseParticipants) * 100,
    },
    {
      weekday: t('shared.generic.tuesday'),
      value: (activeDays.tuesday / courseParticipants) * 100,
    },
    {
      weekday: t('shared.generic.wednesday'),
      value: (activeDays.wednesday / courseParticipants) * 100,
    },
    {
      weekday: t('shared.generic.thursday'),
      value: (activeDays.thursday / courseParticipants) * 100,
    },
    {
      weekday: t('shared.generic.friday'),
      value: (activeDays.friday / courseParticipants) * 100,
    },
    {
      weekday: t('shared.generic.saturday'),
      value: (activeDays.saturday / courseParticipants) * 100,
    },
    {
      weekday: t('shared.generic.sunday'),
      value: (activeDays.sunday / courseParticipants) * 100,
    },
  ]

  const noActivity =
    activeDays.monday === 0 &&
    activeDays.tuesday === 0 &&
    activeDays.wednesday === 0 &&
    activeDays.thursday === 0 &&
    activeDays.friday === 0 &&
    activeDays.saturday === 0 &&
    activeDays.sunday === 0

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.dailyActivity')}</H2>
      {!noActivity ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart layout="vertical" data={barChartData}>
            <XAxis
              type="number"
              tickFormatter={(value) => `${value.toFixed(0)}%`}
              label={{
                value: t('manage.analytics.percentageOfStudents'),
                dy: 12,
              }}
              height={40}
            />
            <YAxis type="category" dataKey="weekday" width={80} />
            <Tooltip
              formatter={(value) => [
                `${(value as number).toFixed(2)} %`,
                t('manage.analytics.activeStudents'),
              ]}
              contentStyle={{
                borderRadius: '8px',
                padding: '8px',
              }}
            />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <UserNotification
          message={t('manage.analytics.noActivityDistributionData')}
          type="info"
        />
      )}
    </div>
  )
}

export default DailyActivityPlot
