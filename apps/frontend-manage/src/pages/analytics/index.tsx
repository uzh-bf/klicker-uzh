import { useQuery } from '@apollo/client'
import { GetUserCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import CourseDashboardList from '~/components/analytics/overview/CourseDashboardList'
import Layout from '~/components/Layout'

function Analytics() {
  const t = useTranslations()
  const router = useRouter()
  const { loading: loadingCourses, data: dataCourses } = useQuery(
    GetUserCoursesDocument
  )

  if (loadingCourses) {
    return (
      <Layout displayName={t('shared.generic.learningAnalytics')}>
        <Loader />
      </Layout>
    )
  }

  const courses = dataCourses?.userCourses

  return (
    <Layout displayName={t('shared.generic.learningAnalytics')}>
      <CourseDashboardList courses={courses} />
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
