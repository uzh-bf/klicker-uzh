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

  const [activateLiveQuizBlock, { loading: activatingBlock }] = useMutation(
    ActivateLiveQuizBlockDocument
  )
  const [deactivateLiveQuizBlock, { loading: deactivatingBlock }] = useMutation(
    DeactivateLiveQuizBlockDocument
  )

  const [endLiveQuiz, { loading: endingLiveQuiz }] = useMutation(
    EndLiveQuizDocument,
    {
      update(cache, { data }) {
        // verify that the live quiz has ended successfully
        if (!data?.endLiveQuiz) return

        // update the list of running live quizzes
        cache.updateQuery(
          { query: GetUserRunningLiveQuizzesDocument },
          (qData) => {
            if (!qData?.userRunningLiveQuizzes) return qData
            return {
              userRunningLiveQuizzes: qData.userRunningLiveQuizzes.filter(
                (q) => q.id !== data.endLiveQuiz!.id
              ),
            }
          }
        )
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
    pinCode,
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
          quizName={name}
          quizPin={pinCode}
          blocks={blocks ?? []}
          language={course?.language ?? null}
          isGamificationEnabled={isGamificationEnabled}
          handleEndLiveQuiz={() => {
            endLiveQuiz({ variables: { id: id } })
            router.push('/activities')
          }}
          handleOpenBlock={(blockId: number) => {
            activateLiveQuizBlock({
              variables: { quizId: id, blockId },
              // high stakes mutation where cache updates are hard due to cached and db data
              refetchQueries: [
                { query: GetCockpitQuizDocument, variables: { id } },
              ],
            })
          }}
          handleCloseBlock={(blockId: number) => {
            deactivateLiveQuizBlock({
              variables: { quizId: id, blockId },
              // high stakes mutation where cache updates are hard due to cached and db data
              refetchQueries: [
                { query: GetCockpitQuizDocument, variables: { id } },
              ],
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
