import { useQuery } from '@apollo/client'
import ActivityEvaluation from '@components/evaluation/ActivityEvaluation'
import Layout from '@components/Layout'
import { GetLiveQuizEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

function Evaluation() {
  const router = useRouter()
  const t = useTranslations()

  // fetch evaluation data
  const { data, loading, error } = useQuery(GetLiveQuizEvaluationDocument, {
    variables: {
      id: router.query.id as string,
      hmac: router.query.hmac as string,
    },
    pollInterval: 5000,
    skip: !router.query.id,
  })

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (error && !data) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  if (
    !data?.liveQuizEvaluation ||
    !data?.liveQuizLeaderboard ||
    (data.liveQuizEvaluation.results.length === 0 &&
      data.liveQuizLeaderboard.length === 0)
  ) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center">
        <UserNotification
          className={{
            root: 'max-w-[80%] text-lg lg:max-w-[60%] 2xl:max-w-[50%]',
          }}
          message={t('manage.evaluation.evaluationNotYetAvailable')}
        />
      </div>
    )
  }

  const evaluation = data.liveQuizEvaluation
  const leaderboard = data.liveQuizLeaderboard

  return (
    <ActivityEvaluation
      activityName={evaluation?.displayName ?? ''}
      stacks={evaluation?.results ?? []}
      feedbacks={evaluation?.feedbacks}
      confusionFeedbacks={evaluation?.confusionFeedbacks}
      leaderboard={leaderboard}
      type="LiveQuiz"
    />
  )
}

export async function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default Evaluation
