import React from 'react'
import PropTypes from 'prop-types'
import { compose, withHandlers, branch, renderComponent } from 'recompose'
import { graphql } from 'react-apollo'
import { intlShape } from 'react-intl'
import Router from 'next/router'

import { pageWithIntl, withData } from '../../lib'

import ConfusionBarometer from '../../components/confusion/ConfusionBarometer'
import FeedbackChannel from '../../components/feedbacks/FeedbackChannel'
import SessionTimeline from '../../components/sessions/SessionTimeline'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import { RunningSessionQuery, EndSessionMutation } from '../../queries'
import { LoadingTeacherLayout } from '../../components/common/Loading'

const propTypes = {
  data: PropTypes.object.isRequired,
  handleEndSession: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const Running = ({ data, intl, handleEndSession }) => {
  const navbarConfig = {
    title: intl.formatMessage({
      defaultMessage: 'Running Session',
      id: 'teacher.runningSession.title',
    }),
  }

  const { runningSession } = data.user
  const {
    isConfusionBarometerActive,
    isFeedbackChannelActive,
    isFeedbackChannelPublic,
  } = runningSession.settings

  return (
    <TeacherLayout
      intl={intl}
      navbar={navbarConfig}
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
            blocks={runningSession.blocks}
            handleRightActionClick={handleEndSession}
          />
        </div>

        <div className="confusionBarometer">
          <ConfusionBarometer
            intl={intl}
            isActive={isConfusionBarometerActive}
            handleActiveToggle={() => null}
          />
        </div>

        <div className="feedbackChannel">
          <FeedbackChannel
            intl={intl}
            data={runningSession.feedbacks}
            isActive={isFeedbackChannelActive}
            isPublic={isFeedbackChannelPublic}
            handleActiveToggle={() => null}
            handlePublicToggle={() => null}
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
}

Running.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(RunningSessionQuery),
  graphql(EndSessionMutation),
  branch(
    ({ data }) => data.loading || !data.user,
    renderComponent(({ intl }) => (
      <LoadingTeacherLayout intl={intl} pageId="runningSession" title="Running Session" />
    )),
  ),
  withHandlers({
    handleEndSession: ({ data, mutate }) => async () => {
      try {
        await mutate({
          refetchQueries: [{ query: RunningSessionQuery }],
          variables: { id: data.user.runningSession.id },
        })
        Router.push('/questions')
      } catch ({ message }) {
        console.error(message)
      }
    },
  }),
)(Running)
