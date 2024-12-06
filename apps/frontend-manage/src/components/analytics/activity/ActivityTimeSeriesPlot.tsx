import { ParticipantActivityTimestamp } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function ActivityTimeSeriesPlot({
  title,
  activity,
  courseParticipants,
}: {
  title: string
  activity: ParticipantActivityTimestamp[]
  courseParticipants: number
}) {
  const t = useTranslations()

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{title}</H2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={activity.map((item) => ({
            ...item,
            activeParticipants:
              (item.activeParticipants / courseParticipants) * 100,
          }))}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const date = new Date(value)
              return date
                .toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
                .replace(/\//g, '-')
            }}
          />
          <YAxis>
            <Label
              value={`${t('manage.analytics.activeStudents')} (%)`}
              angle={-90}
              dx={-20}
            />
          </YAxis>
          <Tooltip
            labelFormatter={(value) => {
              const date = new Date(value)
              return `${t('shared.generic.date')}: ${date
                .toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
                .replace(/\//g, '-')}`
            }}
            formatter={(value) => [
              `${(value as number).toFixed(2)} %`,
              t('manage.analytics.activeStudents'),
            ]}
            contentStyle={{
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          <Line type="monotone" dataKey="activeParticipants" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ActivityTimeSeriesPlot
