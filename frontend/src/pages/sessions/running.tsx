import React, { useEffect, useState } from 'react'
import _get from 'lodash/get'
import _pick from 'lodash/pick'
import _some from 'lodash/some'
import { useRouter } from 'next/router'
import { useQuery, useMutation } from '@apollo/client'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'
import { useToasts } from 'react-toast-notifications'
import { Message, Icon } from 'semantic-ui-react'

import AudienceInteraction from '../../components/interaction/AudienceInteraction'
import useLogging from '../../lib/hooks/useLogging'
import SessionTimeline from '../../components/sessions/SessionTimeline'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import AccountSummaryQuery from '../../graphql/queries/AccountSummaryQuery.graphql'
import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
import EndSessionMutation from '../../graphql/mutations/EndSessionMutation.graphql'
import PauseSessionMutation from '../../graphql/mutations/PauseSessionMutation.graphql'
import CancelSessionMutation from '../../graphql/mutations/CancelSessionMutation.graphql'
import UpdateSessionSettingsMutation from '../../graphql/mutations/UpdateSessionSettingsMutation.graphql'
import ActivateNextBlockMutation from '../../graphql/mutations/ActivateNextBlockMutation.graphql'
import SessionListQuery from '../../graphql/queries/SessionListQuery.graphql'

import RunningSessionUpdatedSubscription from '../../graphql/subscriptions/RunningSessionUpdatedSubscription.graphql'
import ResetQuestionBlockMutation from '../../graphql/mutations/ResetQuestionBlockMutation.graphql'
import ActivateBlockByIdMutation from '../../graphql/mutations/ActivateBlockByIdMutation.graphql'
import Messager from '../../components/common/Messager'

const messages = defineMessages({
  errorLoading: {
    defaultMessage: 'Failed loading current session...',
    id: 'runningSession.errorLoading',
  },
  noRunningSession: {
    defaultMessage: 'No currently running session...',
    id: 'runningSession.noRunningSession',
  },
  pageTitle: {
    defaultMessage: 'Running Session',
    id: 'runningSession.pageTitle',
  },
  title: {
    defaultMessage: 'Running Session',
    id: 'runningSession.title',
  },
})

function Running(): React.ReactElement {
  useLogging()

  const intl = useIntl()
  const router = useRouter()
  const { addToast } = useToasts()

  useEffect((): void => {
    router.prefetch('/sessions/evaluation')
    router.prefetch('/sessions/feedbacks')
    router.prefetch('/join')
    router.prefetch('/qr')
  }, [router])

  const accountSummary = useQuery(AccountSummaryQuery)
  const { data, loading, error, subscribeToMore } = useQuery(RunningSessionQuery, {
    pollInterval: 10000,
  })
  const [updateSettings, { loading: isUpdateSettingsLoading }] = useMutation(UpdateSessionSettingsMutation)
  const [endSession, { loading: isEndSessionLoading }] = useMutation(EndSessionMutation)
  const [pauseSession, { loading: isPauseSessionLoading }] = useMutation(PauseSessionMutation)
  const [resetQuestionBlock, { loading: isResetQuestionBlockLoading }] = useMutation(ResetQuestionBlockMutation)
  const [cancelSession, { loading: isCancelSessionLoading }] = useMutation(CancelSessionMutation)
  const [activateNextBlock, { loading: isActivateNextBlockLoading }] = useMutation(ActivateNextBlockMutation)
  const [activateBlockById, { loading: isActivateBlockByIdLoading }] = useMutation(ActivateBlockByIdMutation)

  const [isParticipantListVisible, setIsParticipantListVisible] = useState(false)

  const shortname = _get(accountSummary, 'data.user.shortname')

  const isAnythingLoading = _some([
    isUpdateSettingsLoading,
    isEndSessionLoading,
    isPauseSessionLoading,
    isResetQuestionBlockLoading,
    isCancelSessionLoading,
    isActivateNextBlockLoading,
    isActivateBlockByIdLoading,
  ])

  return (
    <TeacherLayout
      navbar={{ title: intl.formatMessage(messages.title) }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'runningSession' }}
    >
      {((): React.ReactElement => {
        if (loading || !data || !data.runningSession) {
          return <Messager message={intl.formatMessage(messages.noRunningSession)} />
        }

        if (error) {
          return <Messager message={intl.formatMessage(messages.errorLoading)} />
        }

        const {
          id,
          name,
          activeStep,
          // activeBlock,
          blocks,
          settings,
          startedAt,
          confusionTS,
          feedbacks,
          participants,
        } = data.runningSession

        return (
          <div className="p-4 md:p-8 lg:py-8 lg:px-[10%]">
            <div className="mb-8 md:p-2 print:hidden">
              {settings.isParticipantAuthenticationEnabled && (
                <Message icon warning>
                  <Icon name="lock" />
                  <FormattedMessage
                    defaultMessage="This session is restricted to a predefined list of participants. For participant details, open the"
                    id="runningSession.string.restrictedSession"
                  />
                  <a
                    className="ml-2 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={(): void => setIsParticipantListVisible(true)}
                    onKeyDown={(): void => setIsParticipantListVisible(true)}
                  >
                    <FormattedMessage defaultMessage="Participant List" id="runningSession.string.participantList" />
                  </a>
                  .
                </Message>
              )}
              <SessionTimeline
                // activeBlock={activeBlock}
                activeStep={activeStep}
                authenticationMode={settings.authenticationMode}
                blocks={blocks}
                handleActivateBlockById={(blockId): void => {
                  if (!_some([isActivateBlockByIdLoading, isActivateNextBlockLoading])) {
                    activateBlockById({
                      variables: { blockId, sessionId: id },
                    })
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

                    // redirect to the question pool
                    router.push('/questions')
                  }
                }}
                handleNextBlock={(): void => {
                  if (!_some([isActivateBlockByIdLoading, isActivateNextBlockLoading])) {
                    activateNextBlock({
                      refetchQueries: [{ query: RunningSessionQuery }],
                    })
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

                    router.push('/sessions')
                  }
                }}
                handleResetQuestionBlock={async (blockId): Promise<void> => {
                  await resetQuestionBlock({ variables: { sessionId: id, blockId } })
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
                handleToggleParticipantList={(): void => setIsParticipantListVisible((isVisible) => !isVisible)}
                handleTogglePublicEvaluation={(): void => {
                  updateSettings({
                    variables: {
                      sessionId: id,
                      settings: {
                        isEvaluationPublic: !settings.isEvaluationPublic,
                      },
                    },
                  })
                }}
                intl={intl}
                isEvaluationPublic={settings.isEvaluationPublic}
                isParticipantAuthenticationEnabled={settings.isParticipantAuthenticationEnabled}
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
                        ..._pick(subscriptionData.data.runningSessionUpdated, ['activeBlock', 'activeStep']),
                      },
                    }
                  },
                  variables: { sessionId: id },
                })}
              />
            </div>

            <AudienceInteraction
              confusionTS={confusionTS}
              feedbacks={feedbacks}
              isConfusionBarometerActive={settings.isConfusionBarometerActive}
              isFeedbackChannelActive={settings.isFeedbackChannelActive}
              isFeedbackChannelPublic={settings.isFeedbackChannelPublic}
              sessionId={id}
              sessionName={name}
              subscribeToMore={subscribeToMore}
            />
          </div>
        )
      })()}
    </TeacherLayout>
  )
}

export default Running
