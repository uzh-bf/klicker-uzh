import React from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { compose, withHandlers, branch, renderComponent, withProps } from 'recompose'
import { graphql } from 'react-apollo'
import { intlShape } from 'react-intl'
import Router from 'next/router'

import { pageWithIntl, withData } from '../../lib'

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
import { LoadingTeacherLayout, Messager } from '../../components/common'

const propTypes = {
  activeStep: PropTypes.number.isRequired,
  blocks: PropTypes.array.isRequired,
  confusionTS: PropTypes.array.isRequired,
  feedbacks: PropTypes.array.isRequired,
  handleActivateNextBlock: PropTypes.func.isRequired,
  handleDeleteFeedback: PropTypes.func.isRequired,
  handleEndSession: PropTypes.func.isRequired,
  handleUpdateSettings: PropTypes.func.isRequired,
  id: PropTypes.string.isRequired,
  intl: intlShape.isRequired,
  isConfusionBarometerActive: PropTypes.bool.isRequired,
  isFeedbackChannelActive: PropTypes.bool.isRequired,
  isFeedbackChannelPublic: PropTypes.bool.isRequired,
  runtime: PropTypes.bool.isRequired,
  shortname: PropTypes.string.isRequired,
  startedAt: PropTypes.string.isRequired,
}

const Running = ({
  id,
  intl,
  activeStep,
  blocks,
  confusionTS,
  feedbacks,
  runtime,
  startedAt,
  shortname,
  isConfusionBarometerActive,
  isFeedbackChannelActive,
  isFeedbackChannelPublic,
  handleActivateNextBlock,
  handleDeleteFeedback,
  handleEndSession,
  handleUpdateSettings,
}) => (
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
    <div className="runningSession">
      <div className="sessionProgress">
        <SessionTimeline
          activeStep={activeStep}
          blocks={blocks}
          handleLeftActionClick={handleEndSession}
          handleRightActionClick={handleActivateNextBlock}
          intl={intl}
          runtime={runtime}
          sessionId={id}
          shortname={shortname}
          startedAt={startedAt}
        />
      </div>

      <div className="confusionBarometer">
        <ConfusionBarometer
          confusionTS={confusionTS}
          handleActiveToggle={handleUpdateSettings({
            settings: { isConfusionBarometerActive: !isConfusionBarometerActive },
          })}
          intl={intl}
          isActive={isConfusionBarometerActive}
        />
      </div>

      <div className="feedbackChannel">
        <FeedbackChannel
          feedbacks={feedbacks}
          handleActiveToggle={handleUpdateSettings({
            settings: { isFeedbackChannelActive: !isFeedbackChannelActive },
          })}
          handleDeleteFeedback={handleDeleteFeedback}
          handlePublicToggle={handleUpdateSettings({
            settings: { isFeedbackChannelPublic: !isFeedbackChannelPublic },
          })}
          intl={intl}
          isActive={isFeedbackChannelActive}
          isPublic={isFeedbackChannelPublic}
        />
      </div>
    </div>

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
  withData,
  pageWithIntl,
  graphql(AccountSummaryQuery),
  withProps(({ data }) => ({
    shortname: data.user && data.user.shortname,
  })),
  graphql(RunningSessionQuery, {
    // refetch the running session query every 10s
    options: { pollInterval: 10000 },
  }),
  // TODO: get rid of this branch?
  branch(
    ({ data }) => data.loading || !data.runningSession,
    renderComponent(({ intl }) => (
      <LoadingTeacherLayout intl={intl} pageId="runningSession">
        <Messager
          message={intl.formatMessage({
            defaultMessage: 'No currently running session...',
            id: 'runningSession.noRunningSession',
          })}
        />
      </LoadingTeacherLayout>
    )),
  ),
  graphql(EndSessionMutation, { name: 'endSession' }),
  graphql(UpdateSessionSettingsMutation, { name: 'updateSessionSettings' }),
  graphql(ActivateNextBlockMutation, { name: 'activateNextBlock' }),
  graphql(DeleteFeedbackMutation, { name: 'deleteFeedback' }),
  withHandlers({
    // handle activation of the next block in the session
    handleActivateNextBlock: ({ activateNextBlock }) => async () => {
      try {
        await activateNextBlock({
          refetchQueries: [{ query: RunningSessionQuery }],
        })
      } catch ({ message }) {
        console.error(message)
      }
    },

    // handle deletion of a feedback
    handleDeleteFeedback: ({
      deleteFeedback,
      data: { runningSession },
    }) => feedbackId => async () => {
      console.log('hello world')

      try {
        await deleteFeedback({
          variables: { feedbackId, sessionId: runningSession.id },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },

    // handle ending the currently running session
    handleEndSession: ({ data, endSession }) => async () => {
      try {
        // run the mutation
        await endSession({
          refetchQueries: [{ query: RunningSessionQuery }, { query: AccountSummaryQuery }],
          variables: { id: data.runningSession.id },
        })

        // redirect to the question pool
        // TODO: redirect to a session summary or overview page
        Router.push('/questions')
      } catch ({ message }) {
        console.error(message)
      }
    },

    // handle a session settings update
    handleUpdateSettings: ({ data, updateSessionSettings }) => ({ settings }) => async () => {
      try {
        await updateSessionSettings({
          refetchQueries: [{ query: RunningSessionQuery }],
          variables: { sessionId: data.runningSession.id, settings },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },
  }),
  // flatten out the relevant data props
  withProps(({ data: { runningSession } }) => ({
    ...runningSession,
    ...runningSession.settings,
    startedAt: moment(runningSession.startedAt).format('HH:mm:ss'),
  })),
)(Running)
