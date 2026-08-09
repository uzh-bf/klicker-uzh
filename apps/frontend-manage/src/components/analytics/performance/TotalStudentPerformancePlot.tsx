import {
  ParticipantPerformance,
  PerformanceLevel,
} from '@klicker-uzh/graphql/dist/ops'
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
import LevelTag from '../activity/LevelTag'
import useTotalStudentPerformanceHistogram from './useTotalStudentPerformanceHistogram'

interface TotalStudentPerformancePlotProps {
  courseName: string
  participantPerformance: ParticipantPerformance[]
}

function TotalStudentPerformancePlot({
  courseName,
  participantPerformance,
}: TotalStudentPerformancePlotProps) {
  const t = useTranslations()
  const performanceData = useTotalStudentPerformanceHistogram({
    participantPerformance,
  })

  if (performanceData.length === 0) {
    return null
  }

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.overallStudentPerformance')}</H2>
      {participantPerformance.length > 0 ? (
        <div className="flex flex-col gap-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData} margin={{ bottom: 15, top: 20 }}>
              <XAxis
                dataKey="errorRate"
                label={{
                  value: `${t('manage.analytics.errorRate')} [%]`,
                  dy: 18,
                }}
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
                  t('manage.analytics.numberOfStudents'),
                ]}
                labelFormatter={(label) =>
                  `${t('manage.analytics.errorRate')}: ${label} %`
                }
                contentStyle={{
                  borderRadius: '8px',
                  padding: '8px',
                }}
              />
              <Bar dataKey="count">
                {performanceData.map((entry) => (
                  <Cell key={`cell-${entry.errorRate}`} fill={entry.color} />
                ))}
              </Bar>
              {performanceData.map(
                (entry) =>
                  (entry.isQ1 ||
                    entry.isQ3 ||
                    entry.isMedian ||
                    entry.isMean) && (
                    <ReferenceLine
                      key={`line-${entry.errorRate}`}
                      x={entry.errorRate}
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
                accessorKey: 'totalErrorRate',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t('manage.analytics.totalErrorRate')}
                    />
                  )
                },
                cell: ({ row }: any) =>
                  `${Math.round(parseFloat(row.getValue('totalErrorRate')) * 100)} %`,
                displayName: t('manage.analytics.totalErrorRate'),
              },
              {
                accessorKey: 'firstErrorRate',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t('manage.analytics.firstAttempt')}
                    />
                  )
                },
                cell: ({ row }: any) =>
                  `${Math.round(parseFloat(row.getValue('firstErrorRate')) * 100)} %`,
                displayName: t('manage.analytics.firstAttempt'),
              },
              {
                accessorKey: 'lastErrorRate',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t('manage.analytics.lastAttempt')}
                    />
                  )
                },
                cell: ({ row }: any) =>
                  `${Math.round(parseFloat(row.getValue('lastErrorRate')) * 100)} %`,
                displayName: t('manage.analytics.lastAttempt'),
              },
              {
                accessorKey: 'performanceLevelNumber',
                header: ({ column }: any) => {
                  return (
                    <TableSortingButton
                      column={column}
                      title={t('manage.analytics.performanceLevel')}
                    />
                  )
                },
                cell: ({ row }: any) => (
                  <LevelTag level={row.getValue('performanceLevelNumber')} />
                ),
                displayName: t('manage.analytics.performanceLevel'),
              },
            ]}
            data={participantPerformance.map((entry, ix) => ({
              ...entry,
              student: t('manage.analytics.studentN', { number: ix + 1 }),
              performanceLevelNumber:
                entry.totalPerformance === PerformanceLevel.High
                  ? 3
                  : entry.totalPerformance === PerformanceLevel.Medium
                    ? 2
                    : 1,
            }))}
            csvFilename={`${courseName.replace(' ', '-')}_participant_performance`}
            className={{
              tableHeader: 'h-7 p-2',
              tableCell: 'h-7 p-2',
            }}
          />
        </div>
      ) : (
        <UserNotification
          type="info"
          message={t('manage.analytics.noStudentPerformanceData')}
        />
      )}
    </div>
  )
}

export default TotalStudentPerformancePlot
