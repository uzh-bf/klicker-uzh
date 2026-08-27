import { useQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import { GetLearningAnalyticsCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import CourseDashboardList from '../../components/analytics/overview/CourseDashboardList'
import AnalyticsUnavailableView from '../../components/analytics/AnalyticsUnavailableView'
import Layout from '../../components/Layout'

function Analytics() {
  const t = useTranslations()
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')
  const { loading: loadingCourses, data: dataCourses } = useQuery(
    GetLearningAnalyticsCoursesDocument,
    { skip: !learningAnalyticsEnabled }
  )

  if (!learningAnalyticsEnabled) {
    return (
      <AnalyticsUnavailableView
        title={t('shared.generic.learningAnalytics')}
        message={t('manage.analytics.featureUnavailable')}
      />
    )
  }

  if (loadingCourses) {
    return (
      <Layout displayName={t('shared.generic.learningAnalytics')}>
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout displayName={t('shared.generic.learningAnalytics')}>
      <CourseDashboardList
        courses={dataCourses?.userCourses?.filter(
          (course) =>
            course.isLearningAnalyticsEnabled &&
            course.analyticsStatus.areAnalyticsValid
        )}
      />
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

export default Analytics
