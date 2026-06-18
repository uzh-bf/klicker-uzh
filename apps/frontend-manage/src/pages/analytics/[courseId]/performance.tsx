import { H1, TabContent, Tabs } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import AnalyticsErrorView from '../../../components/analytics/AnalyticsErrorView'
import AnalyticsLoadingView from '../../../components/analytics/AnalyticsLoadingView'
import ActivityInstanceFeedbacksPlot from '../../../components/analytics/performance/ActivityInstanceFeedbacksPlot'
import ActivityProgressPlot from '../../../components/analytics/performance/ActivityProgressPlot'
import PerformanceAnalyticsNavigation from '../../../components/analytics/performance/PerformanceAnalyticsNavigation'
import PerformanceRates from '../../../components/analytics/performance/PerformanceRates'
import StudentActivityPerformance from '../../../components/analytics/performance/StudentActivityPerformance'
import TotalStudentPerformancePlot from '../../../components/analytics/performance/TotalStudentPerformancePlot'
import PreviewTag from '../../../components/common/PreviewTag'
import Layout from '../../../components/Layout'
import { trpc } from '../../../lib/trpc'

function PerformanceDashboard() {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.courseId as string

  const [tabValue, setTabValue] = useState<
    | 'performanceRates'
    | 'activityProgress'
    | 'studentPerformance'
    | 'feedbackOverview'
  >('performanceRates')

  const { data, isLoading, error } = trpc.analytics.coursePerformance.useQuery(
    { courseId },
    { enabled: !!courseId }
  )

  const navigation = <PerformanceAnalyticsNavigation courseId={courseId} />
  const course = data?.coursePerformanceAnalytics

  // loading state
  if (isLoading || !courseId) {
    return (
      <AnalyticsLoadingView
        title={t('manage.analytics.performanceDashboard')}
        navigation={navigation}
      />
    )
  }

  // error state
  if (course === null || typeof course === 'undefined' || error) {
    return (
      <AnalyticsErrorView
        title={t('manage.analytics.performanceDashboard')}
        navigation={navigation}
      />
    )
  }

  return (
    <Layout displayName={t('manage.analytics.performanceDashboard')}>
      {navigation}
      <div>
        <div className="mb-3 flex w-full flex-row items-end justify-between font-bold">
          <div className="flex flex-row items-center gap-5">
            <H1 className={{ root: 'mb-0' }}>
              {t('manage.analytics.performanceDashboard')}: {course.name}
            </H1>
            <PreviewTag className="text-base" />
          </div>
          <div>
            {t('manage.analytics.totalParticipants', {
              number: course.totalParticipants,
            })}
          </div>
        </div>
        <Tabs
          defaultValue="performanceRates"
          value={tabValue}
          onValueChange={(newValue: string) =>
            setTabValue(
              newValue as
                | 'performanceRates'
                | 'activityProgress'
                | 'studentPerformance'
                | 'feedbackOverview'
            )
          }
          tabs={[
            {
              id: 'tab-performanceRates',
              value: 'performanceRates',
              label: t('manage.analytics.performanceRates'),
              data: { cy: 'tab-performanceRates' },
            },
            {
              id: 'tab-activityProgress',
              value: 'activityProgress',
              label: t('manage.analytics.activityProgress'),
              data: { cy: 'tab-activityProgress' },
            },
            {
              id: 'tab-studentPerformance',
              value: 'studentPerformance',
              label: t('manage.analytics.studentPerformance'),
              data: { cy: 'tab-studentPerformance' },
            },
            {
              id: 'tab-feedbackOverview',
              value: 'feedbackOverview',
              label: t('manage.analytics.feedbackOverview'),
              data: { cy: 'tab-feedbackOverview' },
            },
          ]}
        >
          <TabContent
            key="content-performanceRates"
            value="performanceRates"
            className={{ root: 'overflow-y-auto px-0 py-2' }}
          >
            <PerformanceRates
              activityPerformances={course.activityPerformances}
              instancePerformances={course.instancePerformances}
            />
          </TabContent>
          <TabContent
            key="content-activityProgress"
            value="activityProgress"
            className={{ root: 'overflow-y-auto px-0 py-2' }}
          >
            <ActivityProgressPlot
              activityProgresses={course.activityProgresses}
              participants={course.totalParticipants}
            />
          </TabContent>
          <TabContent
            key="content-studentPerformance"
            value="studentPerformance"
            className={{
              root: 'flex flex-col gap-3 overflow-y-auto px-0 py-2',
            }}
          >
            <TotalStudentPerformancePlot
              courseName={course.name}
              participantPerformance={course.participantPerformances}
            />
            <StudentActivityPerformance
              courseId={courseId}
              performances={course.participantActivityPerformances}
            />
          </TabContent>
          <TabContent
            key="content-feedbackOverview"
            value="feedbackOverview"
            className={{ root: 'overflow-y-auto px-0 py-2' }}
          >
            <ActivityInstanceFeedbacksPlot
              instanceFeedbacks={course.instanceFeedbacks}
              activityFeedbacks={course.activityFeedbacks}
            />
          </TabContent>
        </Tabs>
      </div>
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

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default PerformanceDashboard
