import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ActivityEvaluation from '../../../components/evaluation/ActivityEvaluation'
import Layout from '../../../components/Layout'
import { trpc } from '../../../lib/trpc'

function MicroLearningEvaluation() {
  const t = useTranslations()
  const router = useRouter()

  // fetch evaluation data
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const { data, isLoading, error } =
    trpc.analytics.microLearningEvaluation.useQuery(
      { id },
      { enabled: id !== '' }
    )

  if (!id || (isLoading && !data)) {
    return (
      <Layout displayName={t('manage.evaluation.microLearningEvaluation')}>
        <Loader />
      </Layout>
    )
  }

  // TODO: potentially display message here that microlearning might not be published yet?
  if (error && !data) {
    return (
      <Layout displayName={t('manage.evaluation.microLearningEvaluation')}>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  if (!data) {
    return (
      <Layout displayName={t('manage.evaluation.microLearningEvaluation')}>
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  const evaluation = data?.microLearningEvaluation

  return (
    <ActivityEvaluation
      courseId={evaluation?.courseId}
      activityId={id}
      activityName={evaluation?.displayName ?? ''}
      stacks={evaluation?.results ?? []}
    />
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

export default MicroLearningEvaluation
