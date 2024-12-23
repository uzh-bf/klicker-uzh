import { useMutation, useQuery } from '@apollo/client'
import {
  ActivateLiveQuizBlockDocument,
  DeactivateLiveQuizBlockDocument,
  EndLiveQuizDocument,
  GetCockpitQuizDocument,
  GetUserLiveQuizzesDocument,
  GetUserRunningLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'
import AudienceInteraction from '../../../components/interaction/AudienceInteraction'
import Layout from '../../../components/Layout'
import LiveQuizTimeline from '../../../components/liveQuiz/cockpit/LiveQuizTimeline'

function Cockpit() {
  const router = useRouter()
  const [isEvaluationPublic, setEvaluationPublic] = useState(false)

  const [activateLiveQuizBlock, { loading: activatingBlock }] = useMutation(
    ActivateLiveQuizBlockDocument
  )
  const [deactivateLiveQuizBlock, { loading: deactivatingBlock }] = useMutation(
    DeactivateLiveQuizBlockDocument
  )
  const [endLiveQuiz, { loading: endingLiveQuiz }] = useMutation(
    EndLiveQuizDocument,
    {
      update(cache, res) {
        const data = cache.readQuery({
          query: GetUserRunningLiveQuizzesDocument,
        })
        cache.writeQuery({
          query: GetUserRunningLiveQuizzesDocument,
          data: {
            userRunningLiveQuizzes:
              data?.userRunningLiveQuizzes?.filter(
                (q) => q.id !== res.data?.endLiveQuiz?.id
              ) ?? [],
          },
        })
      },
      refetchQueries: [
        {
          query: GetUserLiveQuizzesDocument,
        },
      ],
    }
  )

  const {
    loading: cockpitLoading,
    data: cockpitData,
    subscribeToMore,
  } = useQuery(GetCockpitQuizDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 2000,
    skip: !router.query.id,
  })

  // data has not been received yet
  if (cockpitLoading || !cockpitData?.cockpitQuiz)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  const {
    id,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
    isGamificationEnabled,
    namespace,
    name,
    displayName,
    status,
    startedAt,
    course,
    activeBlock,
    blocks,
    confusionSummary,
    feedbacks,
  } = cockpitData.cockpitQuiz

  return (
    <Layout>
      <div className="mb-8 print:hidden">
        <LiveQuizTimeline
          blocks={blocks ?? []}
          quizName={name}
          handleEndLiveQuiz={() => {
            endLiveQuiz({ variables: { id: id } })
            router.push('/quizzes')
          }}
          handleOpenBlock={(blockId: number) => {
            activateLiveQuizBlock({
              variables: { quizId: id, blockId },
            })
          }}
          handleCloseBlock={(blockId: number) => {
            deactivateLiveQuizBlock({
              variables: { quizId: id, blockId },
            })
          }}
          handleTogglePublicEvaluation={() =>
            setEvaluationPublic(!isEvaluationPublic)
          }
          isEvaluationPublic={isEvaluationPublic}
          quizId={id}
          startedAt={startedAt}
          loading={activatingBlock || deactivatingBlock || endingLiveQuiz}
        />
      </div>

      <AudienceInteraction
        subscribeToMore={subscribeToMore}
        confusionValues={confusionSummary ?? undefined}
        feedbacks={feedbacks ?? []}
        isLiveQAEnabled={isLiveQAEnabled}
        isConfusionFeedbackEnabled={isConfusionFeedbackEnabled}
        isModerationEnabled={isModerationEnabled}
        isGamificationEnabled={isGamificationEnabled}
        quizId={id}
        liveQuizName={name}
      />
    </Layout>
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

export default Cockpit
