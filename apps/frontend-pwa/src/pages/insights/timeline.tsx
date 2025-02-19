import { useQuery } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faCalendarDays,
  faCheck,
  faHourglassHalf,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetCourseStudentTimelinesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { Badge } from '@uzh-bf/design-system/dist/future'
import { GetStaticPropsContext } from 'next'
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
import Layout from '../../components/Layout'

function StudentTimelines() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetCourseStudentTimelinesDocument)

  if (loading) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={`${t('pwa.general.insights')} - ${t('pwa.general.timeline')}`}
      >
        <Loader />
      </Layout>
    )
  }

  const courses = data?.getCourseStudentTimelines

  // TODO: extract components for course information and chart to separate components
  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={`${t('pwa.general.insights')} - ${t('pwa.general.timeline')}`}
    >
      {!courses || courses.length === 0 ? (
        <UserNotification
          type="info"
          message={t('pwa.insights.noCourseDataAvailable')}
        />
      ) : (
        <div className="flex flex-col gap-12 md:gap-5">
          {courses.map((course) => {
            const totalPoints =
              course.timelineEntries && course.timelineEntries.length > 0
                ? course.timelineEntries[course.timelineEntries.length - 1]
                    .totalPoints
                : 0
            const totalXp =
              course.timelineEntries && course.timelineEntries.length > 0
                ? course.timelineEntries[course.timelineEntries.length - 1]
                    .totalXp
                : 0

            return (
              <div
                key={`timeline-insights-course-${course.courseId}`}
                className="flex w-full flex-col gap-2 md:flex-row md:gap-3"
              >
                <div className="w-full rounded-md bg-gray-100 p-4 shadow md:w-1/2 lg:w-1/3">
                  <div className="flex flex-row justify-between">
                    <H3 className={{ root: 'mb-2' }}>{course.courseName}</H3>
                    <div className="mb-2 w-max text-base">
                      {(() => {
                        const now = new Date()
                        const start = new Date(course.courseStart)
                        const end = new Date(course.courseEnd)
                        if (end < now) {
                          return (
                            <Badge className="mt-0.5 flex w-max items-center gap-2 bg-green-200 font-semibold text-green-700 hover:bg-green-300">
                              <FontAwesomeIcon icon={faCheck} />
                              {t('pwa.insights.completed')}
                            </Badge>
                          )
                        } else if (start > now) {
                          return (
                            <Badge className="mt-0.5 flex w-max items-center gap-2 bg-blue-200 font-semibold text-blue-700 hover:bg-blue-300">
                              <FontAwesomeIcon icon={faClock} />
                              {t('pwa.insights.upcoming')}
                            </Badge>
                          )
                        } else {
                          return (
                            <Badge className="mt-0.5 flex w-max items-center gap-2 bg-orange-200 font-semibold text-orange-700 hover:bg-orange-300">
                              <FontAwesomeIcon icon={faHourglassHalf} />
                              {t('pwa.insights.ongoing')}
                            </Badge>
                          )
                        }
                      })()}
                    </div>
                  </div>
                  <div className="mb-2 flex items-center text-sm text-gray-600">
                    <FontAwesomeIcon icon={faCalendarDays} className="mr-2" />
                    <span>
                      {new Date(course.courseStart).toLocaleDateString('de-DE')}{' '}
                      - {new Date(course.courseEnd).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <div className="text-sm">
                    <div>
                      {`${t('pwa.insights.totalPoints')}: ${totalPoints}`}
                    </div>
                    <div>{`${t('pwa.insights.totalXp')}: ${totalXp}`}</div>
                  </div>
                </div>
                <div className="w-full md:w-1/2 lg:w-2/3">
                  {(() => {
                    const courseStartTime = new Date(
                      course.courseStart
                    ).getTime()
                    const courseEndTime = new Date(course.courseEnd).getTime()
                    const now = Date.now()
                    const isOngoing = courseEndTime > now

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
                        timelineData[timelineData.length - 1].timestampValue <
                          now
                      ) {
                        const lastTotals =
                          timelineData.length > 0
                            ? {
                                totalPoints:
                                  timelineData[timelineData.length - 1]
                                    .totalPoints,
                                totalXp:
                                  timelineData[timelineData.length - 1].totalXp,
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
                        timelineData[timelineData.length - 1].timestampValue <
                          courseEndTime
                      ) {
                        const lastTotals =
                          timelineData.length > 0
                            ? {
                                totalPoints:
                                  timelineData[timelineData.length - 1]
                                    .totalPoints,
                                totalXp:
                                  timelineData[timelineData.length - 1].totalXp,
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
                            <linearGradient
                              id="colorPoints"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#8884d8"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="#8884d8"
                                stopOpacity={0.2}
                              />
                            </linearGradient>
                            <linearGradient
                              id="colorXp"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#82ca9d"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="#82ca9d"
                                stopOpacity={0.2}
                              />
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
                                (d) =>
                                  d.timestampValue ===
                                  currentData.timestampValue
                              )
                              const previousData =
                                currentIndex > 0
                                  ? timelineData[currentIndex - 1]
                                  : null
                              const deltaPoints =
                                previousData !== null
                                  ? currentData.totalPoints -
                                    previousData.totalPoints
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
                                      {new Date(label).toLocaleDateString(
                                        'de-DE',
                                        {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                        }
                                      )}
                                    </strong>
                                  </div>
                                  <div>
                                    {t('pwa.insights.totalPoints')}:{' '}
                                    {currentData.totalPoints}{' '}
                                    <span
                                      style={{
                                        color:
                                          deltaPoints >= 0 ? 'green' : 'red',
                                      }}
                                    >
                                      ({deltaPoints >= 0 ? '+' : ''}
                                      {deltaPoints})
                                    </span>
                                  </div>
                                  <div>
                                    {t('pwa.insights.totalXp')}:{' '}
                                    {currentData.totalXp}{' '}
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
                          <Legend
                            verticalAlign="top"
                            align="right"
                            height={36}
                          />
                          <Area
                            type="monotone"
                            dataKey="totalPoints"
                            stroke="#8884d8"
                            fill="url(#colorPoints)"
                            name={t('pwa.insights.totalPoints')}
                          />
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
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default StudentTimelines
