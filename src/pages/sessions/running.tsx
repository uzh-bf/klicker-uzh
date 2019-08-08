import React, { useEffect } from 'react'
import dayjs from 'dayjs'
import _get from 'lodash/get'
import { useRouter } from 'next/router'
import { useQuery, useMutation } from 'react-apollo'
import { defineMessages, useIntl } from 'react-intl'

import useLogging from '../../lib/useLogging'

import { ConfusionBarometer } from '../../components/confusion'
import { FeedbackChannel } from '../../components/feedbacks'
import { SessionTimeline } from '../../components/sessions'
import { TeacherLayout } from '../../components/layouts'
import {
  AccountSummaryQuery,
  RunningSessionQuery,
  EndSessionMutation,
  PauseSessionMutation,
  CancelSessionMutation,
  UpdateSessionSettingsMutation,
  ActivateNextBlockMutation,
  DeleteFeedbackMutation,
  SessionListQuery,
  FeedbackAddedSubscription,
  ConfusionAddedSubscription,
  ResetQuestionBlockMutation,
} from '../../graphql'
import { Messager } from '../../components/common'

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
                handleCancelSession={async () => {
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
                handleEndSession={async () => {
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
                handleNextBlock={() => {
                  activateNextBlock({
                    refetchQueries: [{ query: RunningSessionQuery }],
                  })
                }}
                handlePauseSession={async () => {
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
                handleResetQuestionBlock={async blockId => {
                  await resetQuestionBlock({ variables: { sessionId: id, blockId } })
                }}
                handleTogglePublicEvaluation={() => {
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
              />
            </div>

            <div className="confusionBarometer">
              <ConfusionBarometer
                confusionTS={confusionTS}
                handleActiveToggle={() => {
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
                intl={intl}
                isActive={settings.isConfusionBarometerActive}
                subscribeToMore={() => {
                  subscribeToMore({
                    document: ConfusionAddedSubscription,
                    updateQuery: (prev, { subscriptionData }) => {
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
                handleActiveToggle={() => {
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
                handleDeleteFeedback={feedbackId => {
                  deleteFeedback({
                    variables: { feedbackId, sessionId: id },
                  })
                }}
                handlePublicToggle={() => {
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
                intl={intl}
                isActive={settings.isFeedbackChannelActive}
                isPublic={settings.isFeedbackChannelPublic}
                subscribeToMore={() => {
                  subscribeToMore({
                    document: FeedbackAddedSubscription,
                    updateQuery: (prev, { subscriptionData }) => {
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
