import { ParticipantCourseActivity } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import useTotalStudentActivityHistogram from './useTotalStudentActivityHistogram'

interface TotalStudentActivityPlotProps {
  courseWeeks: number
  participantActivity: ParticipantCourseActivity[]
}

function TotalStudentActivityPlot({
  courseWeeks,
  participantActivity,
}: TotalStudentActivityPlotProps) {
  const t = useTranslations()
  const activityData = useTotalStudentActivityHistogram({
    courseWeeks,
    participantActivity,
  })

  return (
    <div className="border-uzh-grey-80 mb-3 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.overallStudentActivity')}</H2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={activityData} margin={{ bottom: 10, top: 20 }}>
          <XAxis
            dataKey="week"
            label={{ value: t('manage.analytics.activeWeeks'), dy: 18 }}
          />
          <YAxis
            label={{
              value: t('manage.analytics.numberOfStudents'),
              angle: -90,
              dx: -20,
            }}
          />
          <Tooltip
            formatter={(value) => [
              `${value}`,
              t('manage.analytics.activeStudents'),
            ]}
            labelFormatter={(label) => `${label} ${t('shared.generic.weeks')}`}
            contentStyle={{
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          <Bar dataKey="count">
            {activityData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
          {activityData.map(
            (entry, index) =>
              (entry.isQ1 || entry.isQ3 || entry.isMedian || entry.isMean) && (
                <ReferenceLine
                  key={`line-${index}`}
                  x={entry.week}
                  stroke={
                    entry.isMean ? 'red' : entry.isMedian ? 'blue' : '#666'
                  }
                  label={{
                    value: entry.isMean
                      ? t('shared.generic.mean')
                      : entry.isMedian
                        ? t('shared.generic.median')
                        : entry.isQ1
                          ? 'Q1'
                          : 'Q3',
                    position: 'top',
                    fill: entry.isMean
                      ? 'red'
                      : entry.isMedian
                        ? 'blue'
                        : '#666',
                  }}
                />
              )
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TotalStudentActivityPlot
