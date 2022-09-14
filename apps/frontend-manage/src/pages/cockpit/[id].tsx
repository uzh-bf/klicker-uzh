import { useQuery } from '@apollo/client'
import {
  AggregatedConfusionFeedbacks,
  Feedback,
  GetCockpitSessionDocument,
  LecturerSession,
} from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'

import AudienceInteraction from '../../components/interaction/AudienceInteraction'
import Layout from '../../components/Layout'

function Cockpit() {
  const router = useRouter()

  // TODO: add toast notifications - this react library react-toast-notifications is outdated and will not work with react 18
  // const { addToast } = useToasts()

  // useEffect((): void => {
  //   router.prefetch('/sessions/evaluation')
  //   router.prefetch('/sessions/feedbacks')
  //   router.prefetch('/join')
  //   router.prefetch('/qr')
  // }, [router])

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

  // const [isParticipantListVisible, setIsParticipantListVisible] = useState(false)

  // const shortname = _get(accountSummary, 'data.user.shortname')

  // const isAnythingLoading = _some([
  //   isUpdateSettingsLoading,
  //   isEndSessionLoading,
  //   isPauseSessionLoading,
  //   isResetQuestionBlockLoading,
  //   isCancelSessionLoading,
  //   isActivateNextBlockLoading,
  //   isActivateBlockByIdLoading,
  // ])

  const {
    loading: cockpitLoading,
    error: cockpitError,
    data: cockpitData,
  } = useQuery(GetCockpitSessionDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 10000,
    skip: !router.query.id,
  })

  // data has not been received yet
  if (cockpitLoading) return <div>Loading...</div>

  // loading is finished, but was not successful
  if (!cockpitData || cockpitError) {
    // TODO fix router instance not available error
    // router.push('/404')
    return null
  }

  console.log(cockpitData.cockpitSession)

  const {
    id,
    isAudienceInteractionActive,
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
    confusionFeedbacks,
    feedbacks,
  } = cockpitData.cockpitSession as LecturerSession

  // TODO: add gamification leaderboard button
  return (
    <Layout>
      <div className="mb-8 print:hidden">
        {/* // TODO: add hint for authenticated session, if this is enabled */}
        SESSION TIMELINE
        {/* <SessionTimeline
          // activeBlock={activeBlock}
          activeStep={activeStep}
          authenticationMode={settings.authenticationMode}
          blocks={blocks}
          handleActivateBlockById={(blockId): void => {
            if (
              !_some([isActivateBlockByIdLoading, isActivateNextBlockLoading])
            ) {
              activateBlockById({
                variables: { blockId, sessionId: id },
              })
              push(['trackEvent', 'Running Session', 'Block Activated By Id'])
            }
          }}
          handleActiveBlock={(): void => {
            // startPolling(10000)
          }}
          handleCancelSession={async (): Promise<void> => {
            if (!isAnythingLoading) {
              await cancelSession({
                refetchQueries: [
                  { query: SessionListQuery },
                  { query: RunningSessionQuery },
                  { query: AccountSummaryQuery },
                ],
                variables: { id },
              })
              push(['trackEvent', 'Running Session', 'Session Canceled'])

              // redirect to the question pool
              router.push('/sessions')
            }
          }}
          handleEndSession={async (): Promise<void> => {
            if (!isAnythingLoading) {
              // run the mutation
              await endSession({
                refetchQueries: [
                  { query: SessionListQuery },
                  { query: RunningSessionQuery },
                  { query: AccountSummaryQuery },
                ],
                variables: { id },
              })
              push(['trackEvent', 'Running Session', 'Session Finished'])

              // redirect to the question pool
              router.push('/questions')
            }
          }}
          handleNextBlock={(): void => {
            if (
              !_some([isActivateBlockByIdLoading, isActivateNextBlockLoading])
            ) {
              activateNextBlock({
                refetchQueries: [{ query: RunningSessionQuery }],
              })
              push(['trackEvent', 'Running Session', 'Next Block Activated'])
            }
          }}
          handleNoActiveBlock={(): void => {
            // stopPolling()
          }}
          handlePauseSession={async (): Promise<void> => {
            if (!isAnythingLoading) {
              await pauseSession({
                refetchQueries: [
                  { query: SessionListQuery },
                  { query: RunningSessionQuery },
                  { query: AccountSummaryQuery },
                ],
                variables: { id },
              })
              push(['trackEvent', 'Running Session', 'Session Paused'])

              router.push('/sessions')
            }
          }}
          handleResetQuestionBlock={async (blockId): Promise<void> => {
            await resetQuestionBlock({ variables: { sessionId: id, blockId } })
            push(['trackEvent', 'Running Session', 'Question Block Reset'])

            addToast(
              <FormattedMessage
                defaultMessage="Question block successfully reset."
                id="sessions.running.resetSessionblock.success"
              />,
              {
                appearance: 'success',
              }
            )
          }}
          handleToggleParticipantList={(): void =>
            setIsParticipantListVisible((isVisible) => !isVisible)
          }
          handleTogglePublicEvaluation={(): void => {
            updateSettings({
              variables: {
                sessionId: id,
                settings: {
                  isEvaluationPublic: !settings.isEvaluationPublic,
                },
              },
            })
            push(['trackEvent', 'Running Session', 'Evaluation Published'])
          }}
          intl={intl}
          isEvaluationPublic={settings.isEvaluationPublic}
          isParticipantAuthenticationEnabled={
            settings.isParticipantAuthenticationEnabled
          }
          isParticipantListVisible={isParticipantListVisible}
          participants={participants}
          sessionId={id}
          shortname={shortname}
          startedAt={startedAt}
          storageMode={settings.storageMode}
          subscribeToMore={subscribeToMore({
            document: RunningSessionUpdatedSubscription,
            updateQuery: (prev, { subscriptionData }): any => {
              if (!subscriptionData.data) return prev
              return {
                ...prev,
                runningSession: {
                  ...prev.runningSession,
                  ..._pick(subscriptionData.data.runningSessionUpdated, [
                    'activeBlock',
                    'activeStep',
                  ]),
                },
              }
            },
            variables: { sessionId: id },
          })}
          withQuestionBlockExperiments={
            featureFlags?.flags?.questionBlockExperiments
          }
        /> */}
      </div>
      AUDIENCE INTERACTION
      <AudienceInteraction
        confusionValues={
          confusionFeedbacks
            ? (confusionFeedbacks[0] as AggregatedConfusionFeedbacks)
            : undefined
        }
        feedbacks={feedbacks as Feedback[]}
        isAudienceInteractionActive={isAudienceInteractionActive}
        isModerationEnabled={isModerationEnabled}
        isGamificationEnabled={isGamificationEnabled}
        sessionId={id}
        sessionName={name}
      />
    </Layout>
  )
}

export default Cockpit
