import { useQuery } from '@apollo/client'
import ActivityEvaluation from '@components/evaluation/ActivityEvaluation'
import { GetLiveQuizEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useRouter } from 'next/router'
import EvaluationUnavailableNotification from '../../../components/evaluation/EvaluationUnavailableNotification'

function Evaluation() {
  const router = useRouter()

  // fetch evaluation data
  const { data, loading } = useQuery(GetLiveQuizEvaluationDocument, {
    variables: {
      id: router.query.id as string,
      hmac: router.query.hmac as string,
    },
    pollInterval: 5000,
    skip: !router.query.id,
    onError: () => {
      router.push('/404')
    },
  })

  if (loading) {
    return <Loader />
  }

  if (
    !data?.liveQuizEvaluation ||
    !data?.liveQuizLeaderboard ||
    (data.liveQuizEvaluation.results.length === 0 &&
      data.liveQuizLeaderboard.length === 0 &&
      data.liveQuizEvaluation.feedbacks?.length === 0 &&
      data.liveQuizEvaluation.confusionFeedbacks?.length === 0)
  ) {
    return <EvaluationUnavailableNotification />
  }

  const evaluation = data.liveQuizEvaluation
  const leaderboard = data.liveQuizLeaderboard

  return (
    <ActivityEvaluation
      activityId={router.query.id as string}
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
