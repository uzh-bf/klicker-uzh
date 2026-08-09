import { ParticipantCourseActivity } from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import TableSortingButton from '@klicker-uzh/shared-components/src/TableSortingButton'
import { H2, UserNotification } from '@uzh-bf/design-system'
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
import LevelTag from './LevelTag'
import useTotalStudentActivityHistogram from './useTotalStudentActivityHistogram'

interface TotalStudentActivityPlotProps {
  courseName: string
  courseWeeks: number
  participantActivity: ParticipantCourseActivity[]
}

function TotalStudentActivityPlot({
  courseName,
  courseWeeks,
  participantActivity,
}: TotalStudentActivityPlotProps) {
  const t = useTranslations()
  const activityData = useTotalStudentActivityHistogram({
    courseWeeks,
    participantActivity,
  })

  if (activityData.length === 0) {
    return null
  }

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.overallStudentActivity')}</H2>
      {participantActivity.length > 0 ? (
        <div className="flex flex-col gap-2">
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
                  style: { textAnchor: 'middle' },
                }}
              />
              <Tooltip
                formatter={(value) => [
                  `${value}`,
                  t('manage.analytics.activeStudents'),
                ]}
                labelFormatter={(label) =>
                  `${label} ${t('shared.generic.weeks')}`
                }
                contentStyle={{
                  borderRadius: '8px',
                  padding: '8px',
                }}
              />
              <Bar dataKey="count">
                {activityData.map((entry) => (
                  <Cell key={`cell-${entry.week}`} fill={entry.color} />
                ))}
              </Bar>
              {activityData.map(
                (entry) =>
                  (entry.isQ1 ||
                    entry.isQ3 ||
                    entry.isMedian ||
                    entry.isMean) && (
                    <ReferenceLine
                      key={`line-${entry.week}`}
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
          <DataTable
            isPaginated
            isResetSortingEnabled
            columns={[
              {
                accessorKey: 'student',
                header: t('shared.generic.student'),
                displayName: t('shared.generic.student'),
              },
              {
                accessorKey: 'activeWeeks',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t('manage.analytics.activeWeeks')}
                    />
                  )
                },
                displayName: t('manage.analytics.activeWeeks'),
              },
              {
                accessorKey: 'activeDaysPerWeek',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t('manage.analytics.activeDaysPerWeek')}
                    />
                  )
                },
                cell: ({ row }: any) =>
                  `${parseFloat(row.getValue('activeDaysPerWeek')).toFixed(2)}`,
                displayName: t('manage.analytics.activeDaysPerWeek'),
              },
              {
                accessorKey: 'meanElementsPerDay',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t('manage.analytics.meanElementsPerDay')}
                    />
                  )
                },
                cell: ({ row }: any) =>
                  `${parseFloat(row.getValue('meanElementsPerDay')).toFixed(2)}`,
                displayName: t('manage.analytics.meanElementsPerDay'),
              },
              {
                accessorKey: 'activityLevelNumber',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t('manage.analytics.activityLevel')}
                    />
                  )
                },
                cell: ({ row }: any) => (
                  <LevelTag level={row.getValue('activityLevelNumber')} />
                ),
                displayName: t('manage.analytics.activityLevel'),
              },
            ]}
            data={participantActivity.map((entry, ix) => ({
              ...entry,
              student: t('manage.analytics.studentN', { number: ix + 1 }),
              activityLevelNumber:
                entry.activityLevel === 'HIGH'
                  ? 3
                  : entry.activityLevel === 'MEDIUM'
                    ? 2
                    : 1,
            }))}
            csvFilename={`${courseName.replace(' ', '-')}_participant_activity`}
            className={{
              tableHeader: 'h-7 p-2',
              tableCell: 'h-7 p-2',
            }}
          />
        </div>
      ) : (
        <UserNotification
          message={t('manage.analytics.noStudentActivity')}
          type="info"
        />
      )}
    </div>
  )
}

export default TotalStudentActivityPlot
