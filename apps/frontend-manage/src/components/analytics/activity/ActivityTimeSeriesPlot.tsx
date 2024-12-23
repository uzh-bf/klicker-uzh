import { useTranslations } from 'next-intl'
import {
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function ActivityTimeSeriesPlot({
  singleCourse = true,
  currentCourse,
  comparisonCourse,
  activityData,
}: {
  singleCourse?: boolean
  currentCourse?: string
  comparisonCourse?: string
  activityData: { date: string; activeParticipants: number }[]
}) {
  const t = useTranslations()

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={activityData}>
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={true}
          vertical={false}
        />
        <XAxis dataKey="date" />
        <YAxis>
          <Label
            value={`${t('manage.analytics.activeStudents')} (%)`}
            angle={-90}
            dx={-20}
          />
        </YAxis>
        <Tooltip
          labelFormatter={(value) => {
            return singleCourse
              ? `${t('shared.generic.date')}: ${value}`
              : value
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
        <Line
          type="monotone"
          dataKey="activeParticipants"
          stroke="#8884d8"
          name={currentCourse}
        />
        <Line
          type="monotone"
          dataKey="activeParticipantsReference"
          stroke="#808080"
          name={comparisonCourse}
        />
        {!singleCourse && <Legend verticalAlign="top" align="right" />}
      </LineChart>
    </ResponsiveContainer>
  )
}

export default ActivityTimeSeriesPlot
