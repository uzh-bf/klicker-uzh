import { NetworkStatus, useQuery } from '@apollo/client'
import {
  ActivityType,
  GetLiveQuizEvaluationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import ActivityEvaluation from '../../../components/evaluation/ActivityEvaluation'
import EvaluationUnavailableNotification from '../../../components/evaluation/EvaluationUnavailableNotification'

function LiveQuizEvaluation() {
  const router = useRouter()
  const [lastRefetchTime, setLastRefetchTime] = useState<Date | undefined>(
    undefined
  )
  const previousNetworkStatus = useRef<NetworkStatus | undefined>(undefined)

  // fetch evaluation data
  const { data, loading, networkStatus } = useQuery(
    GetLiveQuizEvaluationDocument,
    {
      variables: {
        id: router.query.id as string,
        hmac: router.query.hmac as string,
      },
      pollInterval: 5000,
      notifyOnNetworkStatusChange: true,
      skip: !router.query.id,
      onError: () => {
        router.push('/404')
      },
    }
  )

  useEffect(() => {
    const wasRefetching =
      previousNetworkStatus.current === NetworkStatus.poll ||
      previousNetworkStatus.current === NetworkStatus.refetch

    if (
      networkStatus === NetworkStatus.ready &&
      wasRefetching &&
      data?.liveQuizEvaluation
    ) {
      setLastRefetchTime(new Date())
    }

    previousNetworkStatus.current = networkStatus
  }, [data?.liveQuizEvaluation, networkStatus])

  if (loading && !data?.liveQuizEvaluation) {
    return <Loader />
  }

  if (!data?.liveQuizEvaluation) {
    return (
      <EvaluationUnavailableNotification
        activityId={router.query.id as string}
        activityType={ActivityType.LiveQuiz}
      />
    )
  }

  if (
    data.liveQuizEvaluation.results.length === 0 &&
    data.liveQuizLeaderboard?.length === 0 &&
    data.liveQuizEvaluation.feedbacks?.length === 0 &&
    data.liveQuizEvaluation.confusionFeedbacks?.length === 0
  ) {
    return (
      <EvaluationUnavailableNotification
        activityId={data.liveQuizEvaluation.id}
        activityName={data.liveQuizEvaluation.displayName}
        activityType={ActivityType.LiveQuiz}
        activityStatus={data.liveQuizEvaluation.status}
        courseName={data.liveQuizEvaluation.courseName}
      />
    )
  }

  const evaluation = data.liveQuizEvaluation
  const leaderboard = data.liveQuizLeaderboard

  return (
    <ActivityEvaluation
      type="LiveQuiz"
      activityType={ActivityType.LiveQuiz}
      hideActiveBlockResults={!router.query.hmac} // hide the results for active blocks when not inside PPT
      activityId={router.query.id as string}
      activityName={evaluation.displayName ?? ''}
      activityStatus={evaluation.status ?? undefined}
      courseLanguage={evaluation.courseLanguage}
      courseName={evaluation.courseName}
      stacks={evaluation.results ?? []}
      feedbacks={evaluation.feedbacks}
      confusionFeedbacks={evaluation.confusionFeedbacks}
      isAssessmentEnabled={evaluation.isAssessmentEnabled ?? false}
      pinCode={evaluation.pinCode ?? null}
      leaderboard={leaderboard}
      lastRefetchTime={lastRefetchTime}
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
