import React from 'react'
import PropTypes from 'prop-types'
import { compose, withHandlers, branch, renderComponent, withProps } from 'recompose'
import { graphql } from 'react-apollo'
import { intlShape } from 'react-intl'
import Router from 'next/router'

import { pageWithIntl, withData } from '../../lib'

import { ConfusionBarometer } from '../../components/confusion'
import { FeedbackChannel } from '../../components/feedbacks'
import { SessionTimeline } from '../../components/sessions'
import { TeacherLayout } from '../../components/layouts'
import { RunningSessionQuery } from '../../graphql/queries'
import { EndSessionMutation, UpdateSessionSettingsMutation } from '../../graphql/mutations'
import { LoadingTeacherLayout } from '../../components/common/Loading'

const propTypes = {
  blocks: PropTypes.array.isRequired,
  confusionTS: PropTypes.array.isRequired,
  feedbacks: PropTypes.array.isRequired,
  handleEndSession: PropTypes.func.isRequired,
  handleUpdateSettings: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  isConfusionBarometerActive: PropTypes.bool.isRequired,
  isFeedbackChannelActive: PropTypes.bool.isRequired,
  isFeedbackChannelPublic: PropTypes.bool.isRequired,
}

const Running = ({
  intl,
  blocks,
  confusionTS,
  feedbacks,
  isConfusionBarometerActive,
  isFeedbackChannelActive,
  isFeedbackChannelPublic,
  handleEndSession,
  handleUpdateSettings,
}) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage({
        defaultMessage: 'Running Session',
        id: 'teacher.runningSession.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Running Session',
      id: 'teacher.runningSession.pageTitle',
    })}
    sidebar={{ activeItem: 'runningSession' }}
  >
    <div className="runningSession">
      <div className="sessionProgress">
        <SessionTimeline intl={intl} blocks={blocks} handleRightActionClick={handleEndSession} />
      </div>

      <div className="confusionBarometer">
        <ConfusionBarometer
          intl={intl}
          confusionTS={confusionTS}
          isActive={isConfusionBarometerActive}
          handleActiveToggle={handleUpdateSettings({
            settings: { isConfusionBarometerActive: !isConfusionBarometerActive },
          })}
        />
      </div>

      <div className="feedbackChannel">
        <FeedbackChannel
          intl={intl}
          feedbacks={feedbacks}
          isActive={isFeedbackChannelActive}
          isPublic={isFeedbackChannelPublic}
          handleActiveToggle={handleUpdateSettings({
            settings: { isFeedbackChannelActive: !isFeedbackChannelActive },
          })}
          handlePublicToggle={handleUpdateSettings({
            settings: { isFeedbackChannelPublic: !isFeedbackChannelPublic },
          })}
        />
      </div>
    </div>

    <style jsx>{`
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

      @media all and (min-width: 768px) {
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

      @media all and (min-width: 991px) {
        .runningSession {
          padding: 2rem 10%;
        }
      }
    `}</style>
  </TeacherLayout>
)

Running.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(RunningSessionQuery, {
    // refetch the running session query every 10s
    options: { pollInterval: 10000 },
  }),
  // TODO: get rid of this branch?
  branch(
    ({ data }) => data.loading || !data.user,
    renderComponent(({ intl }) => (
      <LoadingTeacherLayout intl={intl} pageId="runningSession" title="Running Session" />
    )),
  ),
  graphql(EndSessionMutation, { name: 'endSession' }),
  graphql(UpdateSessionSettingsMutation, { name: 'updateSessionSettings' }),
  withHandlers({
    // handle ending the currently running session
    handleEndSession: ({ data, endSession }) => async () => {
      try {
        // run the mutation
        await endSession({
          refetchQueries: [{ query: RunningSessionQuery }],
          variables: { id: data.user.runningSession.id },
        })

        // redirect to the question pool
        // TODO: redirect to a session summary or overview page
        Router.push('/questions')
      } catch ({ message }) {
        console.error(message)
      }
    },

    // handle session settings updates
    handleUpdateSettings: ({ data, updateSessionSettings }) => ({ settings }) => async () => {
      try {
        await updateSessionSettings({
          variables: { sessionId: data.user.runningSession.id, settings },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },
  }),
  // flatten out the relevant data props
  withProps(({ data }) => ({
    ...data.user.runningSession,
  })),
)(Running)
