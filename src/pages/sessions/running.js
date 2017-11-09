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
import { AccountSummaryQuery, RunningSessionQuery } from '../../graphql/queries'
import {
  EndSessionMutation,
  UpdateSessionSettingsMutation,
  ActivateNextBlockMutation,
} from '../../graphql/mutations'
import { LoadingTeacherLayout, Messager } from '../../components/common'

const propTypes = {
  blocks: PropTypes.array.isRequired,
  confusionTS: PropTypes.array.isRequired,
  feedbacks: PropTypes.array.isRequired,
  handleActivateNextBlock: PropTypes.func.isRequired,
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
  handleActivateNextBlock,
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
        <SessionTimeline
          intl={intl}
          blocks={blocks}
          handleLeftActionClick={handleEndSession}
          handleRightActionClick={handleActivateNextBlock}
        />
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
  graphql(RunningSessionQuery, {
    // refetch the running session query every 10s
    options: { pollInterval: 10000 },
  }),
  // TODO: get rid of this branch?
  branch(
    ({ data }) => data.loading || !data.runningSession,
    renderComponent(({ intl }) => (
      <LoadingTeacherLayout intl={intl} pageId="runningSession">
        <Messager intl={intl} message="No currently running session..." />
      </LoadingTeacherLayout>
    )),
  ),
  graphql(EndSessionMutation, { name: 'endSession' }),
  graphql(UpdateSessionSettingsMutation, { name: 'updateSessionSettings' }),
  graphql(ActivateNextBlockMutation, { name: 'activateNextBlock' }),
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
  withProps(({ data }) => ({
    ...data.runningSession,
  })),
)(Running)
