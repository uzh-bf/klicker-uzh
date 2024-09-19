import { useQuery } from '@apollo/client'
import ActivityEvaluation from '@components/evaluation/ActivityEvaluation'
import Layout from '@components/Layout'
import { GetPracticeQuizEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

function PracticeQuizEvaluation() {
  const t = useTranslations()
  const router = useRouter()

  // fetch evaluation data
  const { data, loading, error } = useQuery(GetPracticeQuizEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
  })

  if (loading) {
    return (
      <Layout displayName={t('manage.evaluation.practiceQuizEvaluation')}>
        <Loader />
      </Layout>
    )
  }

  // TODO: potentially display message here that practice quiz might not be published yet?
  if (error || !data) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const evaluation = data?.getPracticeQuizEvaluation
  return (
    <ActivityEvaluation
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

export default PracticeQuizEvaluation