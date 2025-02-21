import { CourseStudentTimeline } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function TimelineCourseChart({ course }: { course: CourseStudentTimeline }) {
  const t = useTranslations()

  return (
    <div className="w-full md:w-1/2 lg:w-2/3">
      {(() => {
        const courseStartTime = new Date(course.courseStart).getTime()
        const courseEndTime = new Date(course.courseEnd).getTime()
        const now = Date.now()
        const isOngoing = courseEndTime > now
        const gamified = course.courseGamified

        const timelineData = course.timelineEntries
          ? course.timelineEntries
              .map((entry) => ({
                ...entry,
                timestampValue: new Date(entry.timestamp).getTime(),
              }))
              .sort((a, b) => a.timestampValue - b.timestampValue)
          : []

        // add a datapoint at the beginning if needed
        if (
          timelineData.length === 0 ||
          timelineData[0].timestampValue > courseStartTime
        ) {
          timelineData.unshift({
            timestamp: course.courseStart,
            timestampValue: courseStartTime,
            collectedPoints: 0,
            collectedXp: 0,
            totalPoints: 0,
            totalXp: 0,
          })
        }

        if (isOngoing) {
          // for ongoing courses, add a datapoint at the current time if needed.
          if (
            timelineData.length === 0 ||
            timelineData[timelineData.length - 1].timestampValue < now
          ) {
            const lastTotals =
              timelineData.length > 0
                ? {
                    totalPoints:
                      timelineData[timelineData.length - 1].totalPoints,
                    totalXp: timelineData[timelineData.length - 1].totalXp,
                  }
                : { totalPoints: 0, totalXp: 0 }
            timelineData.push({
              timestamp: new Date(now).toISOString(),
              timestampValue: now,
              collectedPoints: 0,
              collectedXp: 0,
              ...lastTotals,
            })
          }
        } else {
          // for past or future courses, ensure the timeline ends at the course end date.
          if (
            timelineData.length === 0 ||
            timelineData[timelineData.length - 1].timestampValue < courseEndTime
          ) {
            const lastTotals =
              timelineData.length > 0
                ? {
                    totalPoints:
                      timelineData[timelineData.length - 1].totalPoints,
                    totalXp: timelineData[timelineData.length - 1].totalXp,
                  }
                : { totalPoints: 0, totalXp: 0 }
            timelineData.push({
              timestamp: course.courseEnd,
              timestampValue: courseEndTime,
              collectedPoints: 0,
              collectedXp: 0,
              ...lastTotals,
            })
          }
        }

        return (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={timelineData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                {gamified && (
                  <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0.2} />
                  </linearGradient>
                )}
                <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestampValue"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(tick) =>
                  new Date(tick).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                }
              />
              <YAxis />
              <Tooltip
                content={(tooltipProps) => {
                  const { active, payload, label } = tooltipProps
                  if (!active || !payload || payload.length === 0) {
                    return null
                  }
                  const currentData = payload[0].payload
                  // Find the index of the current datapoint
                  const currentIndex = timelineData.findIndex(
                    (d) => d.timestampValue === currentData.timestampValue
                  )
                  const previousData =
                    currentIndex > 0 ? timelineData[currentIndex - 1] : null
                  const deltaPoints =
                    gamified &&
                    previousData !== null &&
                    previousData.totalPoints !== null &&
                    typeof previousData.totalPoints !== 'undefined'
                      ? currentData.totalPoints - previousData.totalPoints
                      : 0
                  const deltaXp =
                    previousData !== null
                      ? currentData.totalXp - previousData.totalXp
                      : 0
                  return (
                    <div
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      <div>
                        <strong>
                          {new Date(label).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </strong>
                      </div>
                      {gamified && (
                        <div>
                          {t('pwa.insights.totalPoints')}:{' '}
                          {currentData.totalPoints}{' '}
                          <span
                            style={{
                              color: deltaPoints >= 0 ? 'green' : 'red',
                            }}
                          >
                            ({deltaPoints >= 0 ? '+' : ''}
                            {deltaPoints})
                          </span>
                        </div>
                      )}
                      <div>
                        {t('pwa.insights.totalXp')}: {currentData.totalXp}{' '}
                        <span
                          style={{
                            color: deltaXp >= 0 ? 'green' : 'red',
                          }}
                        >
                          ({deltaXp >= 0 ? '+' : ''}
                          {deltaXp})
                        </span>
                      </div>
                    </div>
                  )
                }}
                labelFormatter={(label) =>
                  new Date(label).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                }
              />
              <Legend verticalAlign="top" align="right" height={36} />
              {gamified && (
                <Area
                  type="monotone"
                  dataKey="totalPoints"
                  stroke="#8884d8"
                  fill="url(#colorPoints)"
                  name={t('pwa.insights.totalPoints')}
                />
              )}
              <Area
                type="monotone"
                dataKey="totalXp"
                stroke="#82ca9d"
                fill="url(#colorXp)"
                name={t('pwa.insights.totalXp')}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      })()}
    </div>
  )
}

export default TimelineCourseChart
