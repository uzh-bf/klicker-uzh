import { useQuery } from '@apollo/client'
import { GetCourseActivityAnalyticsV2Document } from '@klicker-uzh/graphql/dist/ops'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H1,
  H2,
  UserNotification,
} from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ActivityAnalyticsNavigation from '../../../components/analytics/activity/ActivityAnalyticsNavigation'
import AnalyticsAccessGuard from '../../../components/analytics/AnalyticsAccessGuard'
import useCourseLearningAnalyticsControl from '../../../components/analytics/useCourseLearningAnalyticsControl'
import Layout from '../../../components/Layout'

function ActivityDashboard() {
  const t = useTranslations()
  const router = useRouter()
  const courseId =
    typeof router.query.courseId === 'string'
      ? router.query.courseId
      : undefined
  const control = useCourseLearningAnalyticsControl(courseId)

  const { data, loading, error } = useQuery(
    GetCourseActivityAnalyticsV2Document,
    {
      variables: { courseId: courseId ?? '' },
      skip: !courseId || !control.courseEnabled || !control.analyticsValid,
      fetchPolicy: 'network-only',
    }
  )
  const analytics = data?.getCourseActivityAnalyticsV2
  const navigation = courseId ? (
    <ActivityAnalyticsNavigation courseId={courseId} />
  ) : undefined

  return (
    <AnalyticsAccessGuard
      title={t('manage.analytics.activityDashboard')}
      courseId={courseId}
      navigation={navigation}
      control={control}
      loading={loading}
      error={error}
      data={analytics}
    >
      {(analytics) => (
        <Layout displayName={t('manage.analytics.activityDashboard')}>
          {navigation}
          <main className="flex flex-col gap-5" data-cy="analytics-activity-v2">
            <H1 className={{ root: 'mb-0' }}>
              {t('manage.analytics.activityDashboard')}
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
                    {t('manage.analytics.weeklyActivityV2')}
                  </H2>
                  {analytics.weeklyActivity.length === 0 ? (
                    <div data-cy="analytics-weekly-empty">
                      <UserNotification
                        type="info"
                        message={t('manage.analytics.noReleasedWeeklyCellsV2')}
                      />
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {analytics.weeklyActivity.map((week) => (
                        <Card
                          key={week.periodIndex}
                          className="gap-1 px-4 py-3"
                        >
                          <CardHeader className="px-0">
                            <CardTitle className="font-normal">
                              {t('manage.analytics.weekN', {
                                number: week.periodIndex,
                              })}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="px-0">
                            {t('manage.analytics.effectiveNV2', {
                              number: week.effectiveN,
                            })}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
        </Layout>
      )}
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

export default ActivityDashboard
