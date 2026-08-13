import { useQuery } from '@apollo/client'
import { GetLiveQuizEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useRouter } from 'next/router'
import ActivityEvaluation from '../../../components/evaluation/ActivityEvaluation'
import CorrelatedResponseExport from '../../../components/evaluation/CorrelatedResponseExport'
import EvaluationUnavailableNotification from '../../../components/evaluation/EvaluationUnavailableNotification'

function LiveQuizEvaluation() {
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
      activityId={router.query.id as string}
      activityName={evaluation?.displayName ?? ''}
      courseLanguage={evaluation?.courseLanguage}
      stacks={evaluation?.results ?? []}
      feedbacks={evaluation?.feedbacks}
      confusionFeedbacks={evaluation?.confusionFeedbacks}
      isAssessmentEnabled={evaluation?.isAssessmentEnabled ?? false}
      pinCode={evaluation?.pinCode ?? null}
      leaderboard={leaderboard}
      toolbarContent={
        evaluation.canExportCorrelatedResponses ? (
          <CorrelatedResponseExport liveQuizId={router.query.id as string} />
        ) : null
      }
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
