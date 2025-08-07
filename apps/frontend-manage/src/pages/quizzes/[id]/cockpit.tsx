import { useMutation, useQuery } from '@apollo/client'
import {
  ActivateLiveQuizBlockDocument,
  DeactivateLiveQuizBlockDocument,
  EndLiveQuizDocument,
  GetCockpitQuizDocument,
  GetUserRunningLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import AudienceInteraction from '../../../components/interaction/AudienceInteraction'
import Layout from '../../../components/Layout'
import LiveQuizTimeline from '../../../components/liveQuiz/cockpit/LiveQuizTimeline'

function Cockpit() {
  const router = useRouter()

  // TODO: add query update
  const [activateLiveQuizBlock, { loading: activatingBlock }] = useMutation(
    ActivateLiveQuizBlockDocument
  )
  // TODO: add query update
  const [deactivateLiveQuizBlock, { loading: deactivatingBlock }] = useMutation(
    DeactivateLiveQuizBlockDocument
  )
  // TODO: add query update
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
    name,
    isLiveQAEnabled,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
    startedAt,
    course,
    blocks,
    confusionSummary,
    feedbacks,
  } = cockpitData.cockpitQuiz

  return (
    <Layout>
      <div className="mb-8 print:hidden">
        <LiveQuizTimeline
          quizId={id}
          isGamificationEnabled={isGamificationEnabled}
          quizName={name}
          blocks={blocks ?? []}
          language={course?.language ?? null}
          handleEndLiveQuiz={() => {
            endLiveQuiz({ variables: { id: id } })
            router.push('/activities')
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
