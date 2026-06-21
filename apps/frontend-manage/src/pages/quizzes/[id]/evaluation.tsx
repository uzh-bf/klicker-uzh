import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import ActivityEvaluation from '../../../components/evaluation/ActivityEvaluation'
import EvaluationUnavailableNotification from '../../../components/evaluation/EvaluationUnavailableNotification'
import { trpc } from '../../../lib/trpc'

function LiveQuizEvaluation() {
  const router = useRouter()

  // fetch evaluation data
  const id = router.query.id as string | undefined
  const hmac = router.query.hmac as string | undefined
  const { data, error, isLoading } = trpc.analytics.liveQuizEvaluation.useQuery(
    { id: id ?? '', hmac },
    {
      enabled: !!id,
      refetchInterval: 5000,
    }
  )

  const evaluation = data?.liveQuizEvaluation
  const leaderboard = data?.liveQuizLeaderboard

  useEffect(() => {
    if (error && !evaluation) {
      void router.push('/404')
    }
  }, [error, evaluation, router])

  if ((isLoading && !evaluation) || !id || (error && !evaluation)) {
    return <Loader />
  }

  if (
    !evaluation ||
    (evaluation.results.length === 0 &&
      leaderboard?.length === 0 &&
      evaluation.feedbacks?.length === 0 &&
      evaluation.confusionFeedbacks?.length === 0)
  ) {
    return <EvaluationUnavailableNotification />
  }

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
