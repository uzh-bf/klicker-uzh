import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import CourseDashboardList from '../../components/analytics/overview/CourseDashboardList'
import Layout from '../../components/Layout'
import { trpc } from '../../lib/trpc'

function Analytics() {
  const t = useTranslations()
  const { data, isLoading } = trpc.course.userCourses.useQuery()

  if (isLoading) {
    return (
      <Layout displayName={t('shared.generic.learningAnalytics')}>
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout displayName={t('shared.generic.learningAnalytics')}>
      <CourseDashboardList courses={data?.userCourses} />
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
