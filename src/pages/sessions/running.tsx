import React, { useEffect } from 'react'
import dayjs from 'dayjs'
import _get from 'lodash/get'
import _pick from 'lodash/pick'
import { useRouter } from 'next/router'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { defineMessages, useIntl } from 'react-intl'

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

  useEffect((): void => {
    router.prefetch('/sessions/evaluation')
    router.prefetch('/join')
    router.prefetch('/qr')
  }, [])

  const accountSummary = useQuery(AccountSummaryQuery)
  const { data, loading, error, subscribeToMore } = useQuery(RunningSessionQuery)
  const [updateSettings] = useMutation(UpdateSessionSettingsMutation)
  const [endSession] = useMutation(EndSessionMutation)
  const [pauseSession] = useMutation(PauseSessionMutation)
  const [resetQuestionBlock] = useMutation(ResetQuestionBlockMutation)
  const [cancelSession] = useMutation(CancelSessionMutation)
  const [activateNextBlock] = useMutation(ActivateNextBlockMutation)
  const [deleteFeedback] = useMutation(DeleteFeedbackMutation)
  const [activateBlockById] = useMutation(ActivateBlockByIdMutation)

  const shortname = _get(accountSummary, 'data.user.shortname')

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
        } = data.runningSession

        return (
          <div className="runningSession">
            <div className="sessionProgress">
              <SessionTimeline
                // activeBlock={activeBlock}
                activeStep={activeStep}
                blocks={blocks}
                handleActivateBlockById={(blockId): void => {
                  activateBlockById({
                    variables: { blockId, sessionId: id },
                  })
                }}
                handleCancelSession={async (): Promise<void> => {
                  await cancelSession({
                    refetchQueries: [
                      { query: SessionListQuery },
                      { query: RunningSessionQuery },
                      { query: AccountSummaryQuery },
                    ],
                    variables: { id },
                  })
                  // redirect to the question pool
                  // TODO: redirect to a session summary or overview page
                  router.push('/questions')
                }}
                handleEndSession={async (): Promise<void> => {
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
                  // TODO: redirect to a session summary or overview page
                  router.push('/questions')
                }}
                handleNextBlock={(): void => {
                  activateNextBlock({
                    refetchQueries: [{ query: RunningSessionQuery }],
                  })
                }}
                handlePauseSession={async (): Promise<void> => {
                  await pauseSession({
                    refetchQueries: [
                      { query: SessionListQuery },
                      { query: RunningSessionQuery },
                      { query: AccountSummaryQuery },
                    ],
                    variables: { id },
                  })

                  router.push('/sessions')
                }}
                handleResetQuestionBlock={(blockId): void => {
                  resetQuestionBlock({ variables: { sessionId: id, blockId } })
                }}
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
                runtime={runtime}
                sessionId={id}
                shortname={shortname}
                startedAt={dayjs(startedAt).format('HH:mm:ss')}
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
            flex: 0 0 30%;
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

export default Running
