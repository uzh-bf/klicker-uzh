import { useQuery } from '@apollo/client'
import {
  ActivityType,
  GetCoursePerformanceAnalyticsV2Document,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H1,
  H2,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  UserNotification,
} from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import AnalyticsAccessGuard from '../../../components/analytics/AnalyticsAccessGuard'
import LearningAnalyticsExportV2 from '../../../components/analytics/LearningAnalyticsExportV2'
import useCourseLearningAnalyticsControl from '../../../components/analytics/useCourseLearningAnalyticsControl'
import PerformanceAnalyticsNavigation from '../../../components/analytics/performance/PerformanceAnalyticsNavigation'
import Layout from '../../../components/Layout'

function PerformanceDashboard() {
  const t = useTranslations()
  const router = useRouter()
  const courseId =
    typeof router.query.courseId === 'string'
      ? router.query.courseId
      : undefined
  const control = useCourseLearningAnalyticsControl(courseId)

  const { data, loading, error } = useQuery(
    GetCoursePerformanceAnalyticsV2Document,
    {
      variables: { courseId: courseId ?? '' },
      skip: !courseId || !control.courseEnabled || !control.analyticsValid,
      fetchPolicy: 'network-only',
    }
  )

  const navigation = courseId ? (
    <PerformanceAnalyticsNavigation courseId={courseId} />
  ) : undefined
  const analytics = data?.getCoursePerformanceAnalyticsV2

  return (
    <AnalyticsAccessGuard
      title={t('manage.analytics.performanceDashboard')}
      courseId={courseId}
      navigation={navigation}
      control={control}
      loading={loading}
      error={error}
      data={analytics}
    >
      {(analytics) => {
        if (!courseId) return null

        return (
          <Layout displayName={t('manage.analytics.performanceDashboard')}>
            {navigation}
            <main
              className="flex flex-col gap-5"
              data-cy="analytics-performance-v2"
            >
              <H1 className={{ root: 'mb-0' }}>
                {t('manage.analytics.performanceDashboard')}
              </H1>
              {analytics.isSuppressed ||
              analytics.effectiveN === null ||
              analytics.effectiveN === undefined ? (
                <div data-cy="analytics-suppressed">
                  <UserNotification
                    type="info"
                    message={t('manage.analytics.suppressedV2')}
                  />
                </div>
              ) : (
                <>
                  <div data-cy="analytics-effective-n">
                    <Card className="gap-1 px-4 py-3">
                      <CardHeader className="px-0">
                        <CardTitle className="font-normal">
                          {t('manage.analytics.releasedSampleSizeV2')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-0 text-2xl font-bold">
                        {analytics.effectiveN}
                      </CardContent>
                    </Card>
                  </div>

                  <section className="flex flex-col gap-3">
                    <H2 className={{ root: 'mb-0' }}>
                      {t('manage.analytics.activitySummariesV2')}
                    </H2>
                    {analytics.activitySummaries.length === 0 ? (
                      <UserNotification
                        type="info"
                        message={t(
                          'manage.analytics.noReleasedActivitySummariesV2'
                        )}
                      />
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {analytics.activitySummaries.map((summary) => (
                          <Card
                            key={summary.activityIndex}
                            className="gap-1 px-4 py-3"
                          >
                            <CardHeader className="px-0">
                              <CardTitle className="font-normal">
                                {t('manage.analytics.activityNV2', {
                                  number: summary.activityIndex,
                                })}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-0">
                              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                                <dt>{t('manage.analytics.activityTypeV2')}</dt>
                                <dd>
                                  {summary.activityType ===
                                  ActivityType.PracticeQuiz
                                    ? t('shared.types.PRACTICE_QUIZ')
                                    : summary.activityType ===
                                        ActivityType.MicroLearning
                                      ? t('shared.types.MICRO_LEARNING')
                                      : t('shared.generic.unknown')}
                                </dd>
                                <dt>
                                  {t('manage.analytics.effectiveNLabelV2')}
                                </dt>
                                <dd>{summary.effectiveN}</dd>
                                <dt>
                                  {t('manage.analytics.completionPercentV2')}
                                </dt>
                                <dd>
                                  {t('manage.analytics.percentV2', {
                                    number: Math.round(
                                      summary.completionPercent
                                    ),
                                  })}
                                </dd>
                                <dt>
                                  {t('manage.analytics.correctnessPercentV2')}
                                </dt>
                                <dd>
                                  {summary.correctPercent === null ||
                                  summary.correctPercent === undefined
                                    ? t(
                                        'manage.analytics.correctnessUnavailableV2'
                                      )
                                    : t('manage.analytics.percentV2', {
                                        number: Math.round(
                                          summary.correctPercent
                                        ),
                                      })}
                                </dd>
                              </dl>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </section>

                  <section
                    className="flex flex-col gap-3"
                    data-cy="analytics-student-report-v2"
                  >
                    <H2 className={{ root: 'mb-0' }}>
                      {t('manage.analytics.studentReportV2')}
                    </H2>
                    {analytics.studentReport.isSuppressed ||
                    analytics.studentReport.effectiveN === null ||
                    analytics.studentReport.effectiveN === undefined ? (
                      <div data-cy="analytics-suppressed">
                        <UserNotification
                          type="info"
                          message={t('manage.analytics.suppressedV2')}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600">
                          {t('manage.analytics.randomizedLabelsV2')}
                        </p>
                        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                          <ShadcnTable>
                            <ShadcnTableHeader className="bg-slate-50">
                              <ShadcnTableRow>
                                <ShadcnTableHead>
                                  {t('manage.analytics.studentLabelV2')}
                                </ShadcnTableHead>
                                <ShadcnTableHead>
                                  {t('manage.analytics.completedActivitiesV2')}
                                </ShadcnTableHead>
                                <ShadcnTableHead>
                                  {t('manage.analytics.meanCompletionV2')}
                                </ShadcnTableHead>
                              </ShadcnTableRow>
                            </ShadcnTableHeader>
                            <ShadcnTableBody>
                              {analytics.studentReport.students.map(
                                (student) => (
                                  <ShadcnTableRow key={student.studentLabel}>
                                    <ShadcnTableCell className="font-medium">
                                      {student.studentLabel}
                                    </ShadcnTableCell>
                                    <ShadcnTableCell>
                                      {student.completedActivities}
                                    </ShadcnTableCell>
                                    <ShadcnTableCell>
                                      {t('manage.analytics.percentV2', {
                                        number: Math.round(
                                          student.meanCompletionPercent
                                        ),
                                      })}
                                    </ShadcnTableCell>
                                  </ShadcnTableRow>
                                )
                              )}
                            </ShadcnTableBody>
                          </ShadcnTable>
                        </div>
                        <LearningAnalyticsExportV2 courseId={courseId} />
                      </>
                    )}
                  </section>
                </>
              )}
            </main>
          </Layout>
        )
      }}
    </AnalyticsAccessGuard>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default PerformanceDashboard
