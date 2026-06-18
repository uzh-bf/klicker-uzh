import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useRouter } from 'next/router'
import ActivityEvaluation from '../../../components/evaluation/ActivityEvaluation'
import EvaluationUnavailableNotification from '../../../components/evaluation/EvaluationUnavailableNotification'
import { trpc } from '../../../lib/trpc'

function LiveQuizEvaluation() {
  const router = useRouter()

  // fetch evaluation data
  const id = router.query.id as string | undefined
  const hmac = router.query.hmac as string | undefined
  const { data, isLoading } = trpc.analytics.liveQuizEvaluation.useQuery(
    { id: id ?? '', hmac },
    {
      enabled: !!id,
      refetchInterval: 5000,
      onError: () => {
        router.push('/404')
      },
    }
  )

  if (isLoading || !id) {
    return <Loader />
  }

  if (
    !data?.liveQuizEvaluation ||
    (data.liveQuizEvaluation.results.length === 0 &&
      data.liveQuizLeaderboard?.length === 0 &&
      data.liveQuizEvaluation.feedbacks?.length === 0 &&
      data.liveQuizEvaluation.confusionFeedbacks?.length === 0)
  ) {
    return <EvaluationUnavailableNotification />
  }

  const evaluation = data.liveQuizEvaluation
  const leaderboard = data.liveQuizLeaderboard

  return (
    <ActivityEvaluation
      type="LiveQuiz"
      hideActiveBlockResults={!router.query.hmac} // hide the results for active blocks when not inside PPT
      activityId={id}
      activityName={evaluation?.displayName ?? ''}
      courseLanguage={evaluation?.courseLanguage}
      stacks={evaluation?.results ?? []}
      feedbacks={evaluation?.feedbacks}
      confusionFeedbacks={evaluation?.confusionFeedbacks}
      isAssessmentEnabled={evaluation?.isAssessmentEnabled ?? false}
      pinCode={evaluation?.pinCode ?? null}
      leaderboard={leaderboard}
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

export default LiveQuizEvaluation
