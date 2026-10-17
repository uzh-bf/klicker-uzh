import { useQuery } from '@apollo/client'
import { GetControlCourseLiveQuizzesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Layout from '../../components/Layout'
import AppBar from '../../components/layout/AppBar'
import LiveQuizList from '../../components/liveQuizzes/LiveQuizList'

function Course() {
  const t = useTranslations()
  const router = useRouter()

  const { loading, error, data } = useQuery(
    GetControlCourseLiveQuizzesDocument,
    {
      variables: { courseId: router.query.id as string },
      // quizzes are started and ended on other screens; revalidate on visit
      fetchPolicy: 'cache-and-network',
      skip: !router.query.id,
    }
  )

  useEffect(() => {
    if (data && !data.controlCourse) {
      router.push('/404')
    }
  }, [data, router])

  const fallbackTitle = t('control.course.courseOverview')

  if (loading && !data) {
    return (
      <Layout
        title={fallbackTitle}
        header={<AppBar title={fallbackTitle} backHref="/" />}
      >
        <Loader />
      </Layout>
    )
  }

  if (!data?.controlCourse || error) {
    return (
      <Layout
        title={fallbackTitle}
        header={<AppBar title={fallbackTitle} backHref="/" />}
      >
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message={t('control.course.loadingFailed')}
        />
      </Layout>
    )
  }

  const { controlCourse } = data

  return (
    <Layout
      title={controlCourse.name}
      header={<AppBar title={controlCourse.name} backHref="/" />}
    >
      <LiveQuizList liveQuizzes={controlCourse.liveQuizzes ?? []} />
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

export default Course
