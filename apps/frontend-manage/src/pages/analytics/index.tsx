import { useQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  GetLearningAnalyticsCoursesDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import AnalyticsUnavailableView from '../../components/analytics/AnalyticsUnavailableView'
import { isCourseLearningAnalyticsAvailable } from '../../components/analytics/courseEligibility'
import CourseDashboardList from '../../components/analytics/overview/CourseDashboardList'
import Layout from '../../components/Layout'

function Analytics() {
  const t = useTranslations()
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')
  const { data: userData, loading: loadingUser } = useQuery(
    UserProfileDocument,
    {
      fetchPolicy: 'cache-and-network',
    }
  )
  const catalystEntitled = userData?.userProfile?.catalyst === true
  const hasLearningAnalyticsAccess =
    learningAnalyticsEnabled && catalystEntitled
  const { loading: loadingCourses, data: dataCourses } = useQuery(
    GetLearningAnalyticsCoursesDocument,
    {
      fetchPolicy: 'network-only',
      skip: !hasLearningAnalyticsAccess,
    }
  )

  if (!learningAnalyticsEnabled) {
    return (
      <AnalyticsUnavailableView
        title={t('shared.generic.learningAnalytics')}
        message={t('manage.analytics.featureUnavailable')}
      />
    )
  }

  if (loadingUser) {
    return (
      <Layout displayName={t('shared.generic.learningAnalytics')}>
        <Loader />
      </Layout>
    )
  }

  if (!catalystEntitled) {
    return (
      <AnalyticsUnavailableView
        title={t('shared.generic.learningAnalytics')}
        message={t('manage.analytics.catalystRequired')}
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
          isCourseLearningAnalyticsAvailable
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
