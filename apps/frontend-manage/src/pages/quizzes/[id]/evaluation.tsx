import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ActivityEvaluation from '../../../components/evaluation/ActivityEvaluation'
import EvaluationUnavailableNotification from '../../../components/evaluation/EvaluationUnavailableNotification'
import { trpc } from '../../../lib/trpc'

function LiveQuizEvaluation() {
  const router = useRouter()
  const t = useTranslations()

  // fetch evaluation data
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const hmac =
    typeof router.query.hmac === 'string' ? router.query.hmac : undefined
  const { data, error, isLoading } = trpc.analytics.liveQuizEvaluation.useQuery(
    { id, hmac },
    {
      enabled: id !== '',
      refetchInterval: 5000,
    }
  )

  const evaluation = data?.liveQuizEvaluation
  const leaderboard = data?.liveQuizLeaderboard

  if (!id || (isLoading && !data)) {
    return <Loader />
  }

  if (error && !data) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center">
        <UserNotification
          className={{
            root: 'max-w-[80%] text-lg lg:max-w-[60%] 2xl:max-w-[50%]',
          }}
          type="error"
          message={t('shared.generic.systemError')}
        />
      </div>
    )
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
    <>
      {error && data ? (
        <UserNotification
          className={{
            root: 'mx-auto mb-4 max-w-[80%] text-lg lg:max-w-[60%] 2xl:max-w-[50%]',
          }}
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}
      <ActivityEvaluation
        type="LiveQuiz"
        hideActiveBlockResults={!hmac} // hide the results for active blocks when not inside PPT
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
    </>
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
