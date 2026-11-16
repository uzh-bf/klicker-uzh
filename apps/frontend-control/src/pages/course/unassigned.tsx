import { useQuery } from '@apollo/client'
import { GetUnassignedControlLiveQuizzesDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../../components/Layout'
import AppBar from '../../components/layout/AppBar'
import LiveQuizList from '../../components/liveQuizzes/LiveQuizList'

function UnassignedLiveQuizzes() {
  const t = useTranslations()
  // quizzes are started and ended on other screens; revalidate on every visit
  const { data, loading } = useQuery(GetUnassignedControlLiveQuizzesDocument, {
    fetchPolicy: 'cache-and-network',
  })

  const title = t('control.home.noCourse')
  const header = <AppBar title={title} backHref="/" />

  if (loading && !data) {
    return (
      <Layout title={title} header={header}>
        <Loader />
      </Layout>
    )
  }

  // a failed background refetch keeps the cached list visible
  if (!data) {
    return (
      <Layout title={title} header={header}>
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message={t('control.home.loadingLiveQuizzesFailed')}
        />
      </Layout>
    )
  }

  return (
    <Layout title={title} header={header}>
      <LiveQuizList liveQuizzes={data.unassignedLiveQuizzes ?? []} />
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

export default UnassignedLiveQuizzes
