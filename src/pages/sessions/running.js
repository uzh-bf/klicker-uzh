import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import Router from 'next/router'
import { compose, withProps, lifecycle } from 'recompose'
import { graphql, Query, Mutation } from 'react-apollo'
import { defineMessages, intlShape } from 'react-intl'

import { pageWithIntl, withLogging } from '../../lib'

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
  UpdateFeedbackMutation,
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

const propTypes = {
  intl: intlShape.isRequired,
  shortname: PropTypes.string.isRequired,
}

const Running = ({ intl, shortname }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage(messages.title),
    }}
    pageTitle={intl.formatMessage(messages.pageTitle)}
    sidebar={{ activeItem: 'runningSession' }}
  >
    <Query query={RunningSessionQuery}>
      {({ data, loading, error, subscribeToMore }) => {
        if (loading || !data || !data.runningSession) {
          return <Messager message={intl.formatMessage(messages.noRunningSession)} />
        }

        if (error) {
          return <Messager message={intl.formatMessage(messages.errorLoading)} />
        }

        const {
          id,
          activeStep,
          activeBlock,
          blocks,
          settings,
          runtime,
          startedAt,
          confusionTS,
          feedbacks,
        } = data.runningSession

        const activeInstanceIds = activeBlock >= 0 ? blocks[activeBlock].instances.map(instance => instance.id) : []

        return (
          <div className="runningSession">
            <div className="sessionProgress">
              <Mutation mutation={UpdateSessionSettingsMutation}>
                {updateSettings => (
                  <Mutation mutation={EndSessionMutation}>
                    {endSession => (
                      <Mutation mutation={PauseSessionMutation}>
                        {pauseSession => (
                          <Mutation mutation={ResetQuestionBlockMutation}>
                            {resetQuestionBlock => (
                              <Mutation mutation={CancelSessionMutation}>
                                {cancelSession => (
                                  <Mutation mutation={ActivateNextBlockMutation}>
                                    {activateNextBlock => (
                                      <SessionTimeline
                                        activeBlock={activeBlock}
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
                                          Router.push('/questions')
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
                                          Router.push('/questions')
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

                                          Router.push('/sessions')
                                        }}
                                        handleResetQuestionBlock={async () => {
                                          await resetQuestionBlock({
                                            variables: { id, instanceIds: activeInstanceIds },
                                          })
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
                                    )}
                                  </Mutation>
                                )}
                              </Mutation>
                            )}
                          </Mutation>
                        )}
                      </Mutation>
                    )}
                  </Mutation>
                )}
              </Mutation>
            </div>

            <div className="confusionBarometer">
              <Mutation mutation={UpdateSessionSettingsMutation}>
                {updateSettings => (
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
                )}
              </Mutation>
            </div>

            <div className="feedbackChannel">
              <Mutation mutation={UpdateSessionSettingsMutation}>
                {updateSettings => (
                  <Mutation mutation={DeleteFeedbackMutation}>
                    {deleteFeedback => (
                      <Mutation mutation={UpdateFeedbackMutation}>
                        {updateFeedback => (
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
                            handleUpdateFeedback={(newTags, feedbackId) => {
                              updateFeedback({
                                refetchQueries: [{ query: RunningSessionQuery }],
                                variables: {
                                  feedbackId,
                                  sessionId: id,
                                  tags: newTags,
                                  settings: {
                                    isFeedbackChannelActive: settings.isFeedbackChannelActive,
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
                                  const newFeedbacks = [
                                    ...prev.runningSession.feedbacks,
                                    subscriptionData.data.feedbackAdded,
                                  ]
                                  const sortedFeedbacks = newFeedbacks.sort((f1, f2) => {
                                    if (f1.tags.length !== 0) {
                                      return 1
                                    }
                                    if (f2.tags.length !== 0) {
                                      return -1
                                    }
                                    return 0
                                  })
                                  return {
                                    ...prev,
                                    runningSession: {
                                      ...prev.runningSession,
                                      feedbacks: sortedFeedbacks,
                                    },
                                  }
                                },
                                variables: { sessionId: id },
                              })
                            }}
                          />
                        )}
                      </Mutation>
                    )}
                  </Mutation>
                )}
              </Mutation>
            </div>
          </div>
        )
      }}
    </Query>

    <style jsx>
      {`
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
      `}
    </style>
  </TeacherLayout>
)

Running.propTypes = propTypes

export default compose(
  lifecycle({
    componentDidMount() {
      Router.prefetch('/sessions/evaluation')
      Router.prefetch('/join')
      Router.prefetch('/qr')
    },
  }),
  withLogging({
    slaask: true,
  }),
  pageWithIntl,
  graphql(AccountSummaryQuery),
  withProps(({ data }) => ({
    shortname: data.user && data.user.shortname,
  }))
)(Running)
