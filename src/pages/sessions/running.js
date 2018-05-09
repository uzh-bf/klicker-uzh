import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { compose, withProps } from 'recompose'
import { graphql, Query, Mutation } from 'react-apollo'
import { intlShape } from 'react-intl'
import Router from 'next/router'

import { pageWithIntl, withData, withLogging } from '../../lib'

import { ConfusionBarometer } from '../../components/confusion'
import { FeedbackChannel } from '../../components/feedbacks'
import { SessionTimeline } from '../../components/sessions'
import { TeacherLayout } from '../../components/layouts'
import {
  AccountSummaryQuery,
  RunningSessionQuery,
  EndSessionMutation,
  UpdateSessionSettingsMutation,
  ActivateNextBlockMutation,
  DeleteFeedbackMutation,
} from '../../graphql'
import { Messager } from '../../components/common'

const propTypes = {
  intl: intlShape.isRequired,
  shortname: PropTypes.string.isRequired,
}

const Running = ({ intl, shortname }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage({
        defaultMessage: 'Running Session',
        id: 'runningSession.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Running Session',
      id: 'runningSession.pageTitle',
    })}
    sidebar={{ activeItem: 'runningSession' }}
  >
    <Query pollInterval={10000} query={RunningSessionQuery}>
      {({ data, loading, error }) => {
        if (loading || !data || !data.runningSession) {
          return (
            <Messager
              message={intl.formatMessage({
                defaultMessage: 'No currently running session...',
                id: 'runningSession.noRunningSession',
              })}
            />
          )
        }

        if (error) {
          return (
            <Messager
              message={intl.formatMessage({
                defaultMessage: 'Failed loading current session...',
                id: 'runningSession.errorLoading',
              })}
            />
          )
        }

        const {
          id,
          activeStep,
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
              <Mutation mutation={EndSessionMutation}>
                {endSession => (
                  <Mutation mutation={ActivateNextBlockMutation}>
                    {activateNextBlock => (
                      <SessionTimeline
                        activeStep={activeStep}
                        blocks={blocks}
                        handleLeftActionClick={async () => {
                          // run the mutation
                          await endSession({
                            refetchQueries: [
                              { query: RunningSessionQuery },
                              { query: AccountSummaryQuery },
                            ],
                            variables: { id },
                          })

                          // redirect to the question pool
                          // TODO: redirect to a session summary or overview page
                          Router.push('/questions')
                        }}
                        handleRightActionClick={() => {
                          activateNextBlock({
                            refetchQueries: [{ query: RunningSessionQuery }],
                          })
                        }}
                        intl={intl}
                        runtime={runtime}
                        sessionId={id}
                        shortname={shortname}
                        startedAt={moment(startedAt).format('HH:mm:ss')}
                      />
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
                  />
                )}
              </Mutation>
            </div>

            <div className="feedbackChannel">
              <Mutation mutation={UpdateSessionSettingsMutation}>
                {updateSettings => (
                  <Mutation mutation={DeleteFeedbackMutation}>
                    {deleteFeedback => (
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
                        handleDeleteFeedback={(feedbackId) => {
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
                      />
                    )}
                  </Mutation>
                )}
              </Mutation>
            </div>
          </div>
        )
      }}
    </Query>

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

Running.propTypes = propTypes

export default compose(
  withLogging(),
  withData,
  pageWithIntl,
  graphql(AccountSummaryQuery),
  withProps(({ data }) => ({
    shortname: data.user && data.user.shortname,
  })),
)(Running)
