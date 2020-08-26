import React, { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import _get from 'lodash/get'
import _pick from 'lodash/pick'
import _some from 'lodash/some'
import { useRouter } from 'next/router'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'
import { useToasts } from 'react-toast-notifications'
import { Message, Icon } from 'semantic-ui-react'

import useLogging from '../../lib/hooks/useLogging'
import ConfusionBarometer from '../../components/confusion/ConfusionBarometer'
import FeedbackChannel from '../../components/feedbacks/FeedbackChannel'
import SessionTimeline from '../../components/sessions/SessionTimeline'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import AccountSummaryQuery from '../../graphql/queries/AccountSummaryQuery.graphql'
import RunningSessionQuery from '../../graphql/queries/RunningSessionQuery.graphql'
import EndSessionMutation from '../../graphql/mutations/EndSessionMutation.graphql'
import PauseSessionMutation from '../../graphql/mutations/PauseSessionMutation.graphql'
import CancelSessionMutation from '../../graphql/mutations/CancelSessionMutation.graphql'
import UpdateSessionSettingsMutation from '../../graphql/mutations/UpdateSessionSettingsMutation.graphql'
import ActivateNextBlockMutation from '../../graphql/mutations/ActivateNextBlockMutation.graphql'
import DeleteFeedbackMutation from '../../graphql/mutations/DeleteFeedbackMutation.graphql'
import SessionListQuery from '../../graphql/queries/SessionListQuery.graphql'
import FeedbackAddedSubscription from '../../graphql/subscriptions/FeedbackAddedSubscription.graphql'
import ConfusionAddedSubscription from '../../graphql/subscriptions/ConfusionAddedSubscription.graphql'
import RunningSessionUpdatedSubscription from '../../graphql/subscriptions/RunningSessionUpdatedSubscription.graphql'
import ResetQuestionBlockMutation from '../../graphql/mutations/ResetQuestionBlockMutation.graphql'
import ActivateBlockByIdMutation from '../../graphql/mutations/ActivateBlockByIdMutation.graphql'
import Messager from '../../components/common/Messager'
import { withApollo } from '../../lib/apollo'

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
  useLogging({ slaask: true })

  const intl = useIntl()
  const router = useRouter()
  const { addToast } = useToasts()

  useEffect((): void => {
    router.prefetch('/sessions/evaluation')
    router.prefetch('/join')
    router.prefetch('/qr')
  }, [])

  const accountSummary = useQuery(AccountSummaryQuery)
  const { data, loading, error, subscribeToMore } = useQuery(RunningSessionQuery, { pollInterval: 5000 })
  const [updateSettings, { loading: isUpdateSettingsLoading }] = useMutation(UpdateSessionSettingsMutation)
  const [endSession, { loading: isEndSessionLoading }] = useMutation(EndSessionMutation)
  const [pauseSession, { loading: isPauseSessionLoading }] = useMutation(PauseSessionMutation)
  const [resetQuestionBlock, { loading: isResetQuestionBlockLoading }] = useMutation(ResetQuestionBlockMutation)
  const [cancelSession, { loading: isCancelSessionLoading }] = useMutation(CancelSessionMutation)
  const [activateNextBlock, { loading: isActivateNextBlockLoading }] = useMutation(ActivateNextBlockMutation)
  const [deleteFeedback, { loading: isDeleteFeedbackLoading }] = useMutation(DeleteFeedbackMutation)
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
    isDeleteFeedbackLoading,
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
          activeStep,
          // activeBlock,
          blocks,
          settings,
          runtime,
          startedAt,
          confusionTS,
          feedbacks,
          participants,
        } = data.runningSession

        return (
          <div className="runningSession">
            <div className="sessionProgress">
              {settings.isParticipantAuthenticationEnabled && (
                <Message icon warning>
                  <Icon name="lock" />
                  <FormattedMessage
                    defaultMessage="This session is restricted to a predefined list of participants. For participant details, open the"
                    id="runningSession.string.restrictedSession"
                  />
                  <a
                    className="participantListTrigger"
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
                  addToast('Question block successfully reset.', {
                    appearance: 'success',
                  })
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
                runtime={runtime}
                sessionId={id}
                shortname={shortname}
                startedAt={dayjs(startedAt).format('HH:mm:ss')}
                storageMode={settings.storageMode}
                subscribeToMore={subscribeToMore({
                  document: RunningSessionUpdatedSubscription,
                  updateQuery: (prev, { subscriptionData }): any => {
                    if (!subscriptionData.data) return prev
                    console.log(subscriptionData.data.runningSessionUpdated.blocks)
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

            <div className="confusionBarometer">
              <ConfusionBarometer
                confusionTS={confusionTS}
                handleActiveToggle={(): void => {
                  updateSettings({
                    refetchQueries: [{ query: RunningSessionQuery }],
                    variables: {
                      sessionId: id,
                      settings: {
                        isConfusionBarometerActive: !settings.isConfusionBarometerActive,
                      },
                    },
                  })
                }}
                isActive={settings.isConfusionBarometerActive}
                subscribeToMore={(): void => {
                  subscribeToMore({
                    document: ConfusionAddedSubscription,
                    updateQuery: (prev, { subscriptionData }): any => {
                      if (!subscriptionData.data) return prev
                      return {
                        ...prev,
                        runningSession: {
                          ...prev.runningSession,
                          confusionTS: [...prev.runningSession.confusionTS, subscriptionData.data.confusionAdded],
                        },
                      }
                    },
                    variables: { sessionId: id },
                  })
                }}
              />
            </div>

            <div className="feedbackChannel">
              <FeedbackChannel
                feedbacks={feedbacks}
                handleActiveToggle={(): void => {
                  updateSettings({
                    refetchQueries: [{ query: RunningSessionQuery }],
                    variables: {
                      sessionId: id,
                      settings: {
                        isFeedbackChannelActive: !settings.isFeedbackChannelActive,
                      },
                    },
                  })
                }}
                handleDeleteFeedback={(feedbackId: string): void => {
                  deleteFeedback({
                    variables: { feedbackId, sessionId: id },
                  })
                }}
                handlePublicToggle={(): void => {
                  updateSettings({
                    refetchQueries: [{ query: RunningSessionQuery }],
                    variables: {
                      sessionId: id,
                      settings: {
                        isFeedbackChannelPublic: !settings.isFeedbackChannelPublic,
                      },
                    },
                  })
                }}
                isActive={settings.isFeedbackChannelActive}
                isPublic={settings.isFeedbackChannelPublic}
                subscribeToMore={(): void => {
                  subscribeToMore({
                    document: FeedbackAddedSubscription,
                    updateQuery: (prev, { subscriptionData }): any => {
                      if (!subscriptionData.data) return prev
                      return {
                        ...prev,
                        runningSession: {
                          ...prev.runningSession,
                          feedbacks: [...prev.runningSession.feedbacks, subscriptionData.data.feedbackAdded],
                        },
                      }
                    },
                    variables: { sessionId: id },
                  })
                }}
              />
            </div>
          </div>
        )
      })()}

      <style jsx>{`
        @import 'src/theme';

        .runningSession {
          display: flex;
          flex-direction: column;

          padding: 1rem;
        }

        .sessionProgress,
        .confusionBarometer,
        .feedbackChannel {
          flex: 1;

          margin-bottom: 1rem;
        }

        a.participantListTrigger {
          cursor: pointer;
          margin-left: 0.5rem;
        }

        @include desktop-tablet-only {
          .runningSession {
            flex-flow: row wrap;

            padding: 2rem;
          }

          .sessionProgress,
          .confusionBarometer,
          .feedbackChannel {
            padding: 0.5rem;
          }

          .sessionProgress {
            flex: 0 0 100%;
            max-width: 100%;
          }
          .confusionBarometer {
            flex: 0 0 40%;
          }
        }

        @include desktop-only {
          .runningSession {
            padding: 2rem 10%;
          }
        }
      `}</style>
    </TeacherLayout>
  )
}

export default withApollo()(Running)
