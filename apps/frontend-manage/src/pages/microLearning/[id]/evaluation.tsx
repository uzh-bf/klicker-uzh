import Loader from '@klicker-uzh/shared-components/src/Loader'
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
  const id = router.query.id as string | undefined
  const { data, isLoading, error } =
    trpc.analytics.microLearningEvaluation.useQuery(
      { id: id ?? '' },
      { enabled: !!id }
    )

  if (isLoading || !id) {
    return (
      <Layout displayName={t('manage.evaluation.microLearningEvaluation')}>
        <Loader />
      </Layout>
    )
  }

  // TODO: potentially display message here that microlearning might not be published yet?
  if (error || !data) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
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
