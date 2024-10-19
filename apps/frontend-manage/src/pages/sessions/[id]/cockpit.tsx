import { useMutation, useQuery } from '@apollo/client'
import {
  ActivateSessionBlockDocument,
  DeactivateSessionBlockDocument,
  EndSessionDocument,
  Feedback,
  GetCockpitSessionDocument,
  GetUserRunningSessionsDocument,
  GetUserSessionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import { useState } from 'react'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import Layout from '../../../components/Layout'
import AudienceInteraction from '../../../components/interaction/AudienceInteraction'
import SessionTimeline from '../../../components/sessions/cockpit/SessionTimeline'

function Cockpit() {
  const router = useRouter()
  const [isEvaluationPublic, setEvaluationPublic] = useState(false)

  const [activateSessionBlock, { loading: activatingBlock }] = useMutation(
    ActivateSessionBlockDocument
  )
  const [deactivateSessionBlock, { loading: deactivatingBlock }] = useMutation(
    DeactivateSessionBlockDocument
  )
  const [endSession, { loading: endingLiveQuiz }] = useMutation(
    EndSessionDocument,
    {
      refetchQueries: [
        {
          query: GetUserRunningSessionsDocument,
        },
        {
          query: GetUserSessionsDocument,
        },
      ],
    }
  )

  // TODO: when refactoring this code to be compatible with the new live quiz setup,
  // think about modifying this logic to only refetch the required live quiz elements
  // regularly (feedbacks should be handled entirely through subscriptions, etc.)
  const {
    loading: cockpitLoading,
    error: cockpitError,
    data: cockpitData,
    subscribeToMore,
  } = useQuery(GetCockpitSessionDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 2000,
    skip: !router.query.id,
  })

  // data has not been received yet
  if (cockpitLoading)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  // loading is finished, but was not successful
  if (!cockpitData?.cockpitSession || cockpitError) {
    // TODO fix router instance not available error
    // router.push('/404')
    return null
  }

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
  } = cockpitData.cockpitSession

  return (
    <Layout>
      <div className="mb-8 print:hidden">
        {/* // TODO: readd all removed features like authenticated sessions, etc. */}
        <SessionTimeline
          blocks={blocks ?? []}
          sessionName={name}
          handleEndSession={() => {
            endSession({ variables: { id: id } })
            router.push('/sessions')
          }}
          handleOpenBlock={(blockId: number) => {
            activateSessionBlock({
              variables: { sessionId: id, sessionBlockId: blockId },
            })
          }}
          handleCloseBlock={(blockId: number) => {
            deactivateSessionBlock({
              variables: { sessionId: id, sessionBlockId: blockId },
            })
          }}
          handleTogglePublicEvaluation={() =>
            setEvaluationPublic(!isEvaluationPublic)
          }
          isEvaluationPublic={isEvaluationPublic}
          sessionId={id}
          startedAt={startedAt}
          loading={activatingBlock || deactivatingBlock || endingLiveQuiz}
        />
      </div>

      <AudienceInteraction
        subscribeToMore={subscribeToMore}
        confusionValues={confusionSummary ?? undefined}
        feedbacks={feedbacks as Feedback[]}
        isLiveQAEnabled={isLiveQAEnabled}
        isConfusionFeedbackEnabled={isConfusionFeedbackEnabled}
        isModerationEnabled={isModerationEnabled}
        isGamificationEnabled={isGamificationEnabled}
        sessionId={id}
        sessionName={name}
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
