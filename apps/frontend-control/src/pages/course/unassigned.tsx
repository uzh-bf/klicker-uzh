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
  const { data, loading, error } = useQuery(
    GetUnassignedControlLiveQuizzesDocument
  )

  const title = t('control.home.noCourse')
  const header = <AppBar title={title} backHref="/" />

  if (loading) {
    return (
      <Layout title={title} header={header}>
        <Loader />
      </Layout>
    )
  }

  if (error || !data) {
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
