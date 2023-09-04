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
import { useTranslations } from 'next-intl'
import Layout from '../../../components/Layout'
import AudienceInteraction from '../../../components/interaction/AudienceInteraction'
import SessionTimeline from '../../../components/sessions/cockpit/SessionTimeline'

function Cockpit() {
  const router = useRouter()
  const t = useTranslations()

  const [isEvaluationPublic, setEvaluationPublic] = useState(false)

  const [activateSessionBlock] = useMutation(ActivateSessionBlockDocument)
  const [deactivateSessionBlock] = useMutation(DeactivateSessionBlockDocument)
  const [endSession] = useMutation(EndSessionDocument, {
    refetchQueries: [
      {
        query: GetUserRunningSessionsDocument,
      },
      {
        query: GetUserSessionsDocument,
      },
    ],
  })

  // useEffect((): void => {
  //   router.prefetch('/sessions/evaluation')
  //   router.prefetch('/sessions/feedbacks')
  //   router.prefetch('/join')
  //   router.prefetch('/qr')
  // }, [router])

  // TODO: implement missing queries and corresponding frontend components
  // const accountSummary = useQuery(AccountSummaryQuery)
  // const { data, loading, error, subscribeToMore } = useQuery(RunningSessionQuery, {
  //   pollInterval: 10000,
  // })
  // const [updateSettings, { loading: isUpdateSettingsLoading }] = useMutation(UpdateSessionSettingsMutation)
  // const [endSession, { loading: isEndSessionLoading }] = useMutation(EndSessionMutation)
  // const [pauseSession, { loading: isPauseSessionLoading }] = useMutation(PauseSessionMutation)
  // const [resetQuestionBlock, { loading: isResetQuestionBlockLoading }] = useMutation(ResetQuestionBlockMutation)
  // const [cancelSession, { loading: isCancelSessionLoading }] = useMutation(CancelSessionMutation)
  // const [activateNextBlock, { loading: isActivateNextBlockLoading }] = useMutation(ActivateNextBlockMutation)
  // const [activateBlockById, { loading: isActivateBlockByIdLoading }] = useMutation(ActivateBlockByIdMutation)

  // const shortname = _get(accountSummary, 'data.user.shortname')

  const {
    loading: cockpitLoading,
    error: cockpitError,
    data: cockpitData,
    subscribeToMore,
  } = useQuery(GetCockpitSessionDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 1000,
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

  // TODO: add gamification leaderboard button
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
