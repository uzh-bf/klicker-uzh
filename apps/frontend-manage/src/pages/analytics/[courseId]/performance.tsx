import { useQuery } from '@apollo/client'
import { GetCoursePerformanceAnalyticsDocument } from '@klicker-uzh/graphql/dist/ops'
import { H1, Tabs } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import PreviewTag from '~/components/common/PreviewTag'
import AnalyticsErrorView from '../../../components/analytics/AnalyticsErrorView'
import AnalyticsLoadingView from '../../../components/analytics/AnalyticsLoadingView'
import ActivityInstanceFeedbacksPlot from '../../../components/analytics/performance/ActivityInstanceFeedbacksPlot'
import ActivityProgressPlot from '../../../components/analytics/performance/ActivityProgressPlot'
import PerformanceAnalyticsNavigation from '../../../components/analytics/performance/PerformanceAnalyticsNavigation'
import PerformanceRates from '../../../components/analytics/performance/PerformanceRates'
import StudentActivityPerformance from '../../../components/analytics/performance/StudentActivityPerformance'
import TotalStudentPerformancePlot from '../../../components/analytics/performance/TotalStudentPerformancePlot'
import Layout from '../../../components/Layout'

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

  const { data, loading, error } = useQuery(
    GetCoursePerformanceAnalyticsDocument,
    { variables: { courseId }, skip: !courseId }
  )

  const navigation = <PerformanceAnalyticsNavigation courseId={courseId} />
  const course = data?.getCoursePerformanceAnalytics

  // loading state
  if (loading || !courseId) {
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
          className={{ root: 'flex-1 basis-2/3' }}
        >
          <Tabs.TabList>
            <Tabs.Tab
              key="tab-performanceRates"
              value="performanceRates"
              label={t('manage.analytics.performanceRates')}
              className={{
                root: 'border border-solid',
                label: twMerge(
                  'whitespace-nowrap text-base',
                  tabValue === 'performanceRates' && 'font-bold'
                ),
              }}
              data={{ cy: 'tab-performanceRates' }}
            />
            <Tabs.Tab
              key="tab-activityProgress"
              value="activityProgress"
              label={t('manage.analytics.activityProgress')}
              className={{
                root: 'border border-solid',
                label: twMerge(
                  'whitespace-nowrap text-base',
                  tabValue === 'activityProgress' && 'font-bold'
                ),
              }}
              data={{ cy: 'tab-activityProgress' }}
            />
            <Tabs.Tab
              key="tab-studentPerformance"
              value="studentPerformance"
              label={t('manage.analytics.studentPerformance')}
              className={{
                root: 'border border-solid',
                label: twMerge(
                  'whitespace-nowrap text-base',
                  tabValue === 'studentPerformance' && 'font-bold'
                ),
              }}
              data={{ cy: 'tab-studentPerformance' }}
            />
            <Tabs.Tab
              key="tab-feedbackOverview"
              value="feedbackOverview"
              label={t('manage.analytics.feedbackOverview')}
              className={{
                root: 'border border-solid',
                label: twMerge(
                  'whitespace-nowrap text-base',
                  tabValue === 'feedbackOverview' && 'font-bold'
                ),
              }}
              data={{ cy: 'tab-feedbackOverview' }}
            />
          </Tabs.TabList>
          <Tabs.TabContent
            key="content-performanceRates"
            value="performanceRates"
            className={{ root: 'overflow-y-auto px-0 py-2' }}
          >
            <PerformanceRates
              activityPerformances={course.activityPerformances}
              instancePerformances={course.instancePerformances}
            />
          </Tabs.TabContent>
          <Tabs.TabContent
            key="content-activityProgress"
            value="activityProgress"
            className={{ root: 'overflow-y-auto px-0 py-2' }}
          >
            <ActivityProgressPlot
              activityProgresses={course.activityProgresses}
              participants={course.totalParticipants}
            />
          </Tabs.TabContent>
          <Tabs.TabContent
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
          </Tabs.TabContent>
          <Tabs.TabContent
            key="content-feedbackOverview"
            value="feedbackOverview"
            className={{ root: 'overflow-y-auto px-0 py-2' }}
          >
            <ActivityInstanceFeedbacksPlot
              instanceFeedbacks={course.instanceFeedbacks}
              activityFeedbacks={course.activityFeedbacks}
            />
          </Tabs.TabContent>
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
