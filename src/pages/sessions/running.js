import React from 'react'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { graphql } from 'react-apollo'
import { intlShape } from 'react-intl'
import Router from 'next/router'

import { pageWithIntl, withData } from '../../lib'

import ConfusionBarometer from '../../components/confusion/ConfusionBarometer'
import FeedbackChannel from '../../components/feedbacks/FeedbackChannel'
import SessionTimeline from '../../components/sessions/SessionTimeline'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import { RunningSessionQuery, EndSessionMutation } from '../../queries'

const propTypes = {
  data: PropTypes.object.isRequired,
  endSession: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

class Running extends React.Component {
  state = {
    confusionActive: false,
    feedbacksActive: false,
    feedbacksPublic: false,
  }

  handleConfusionActiveToggle = () => {
    // TODO: trigger mutation instead of updating state
    // TODO: trigger refetch and update values
    this.setState(prevState => ({ confusionActive: !prevState.confusionActive }))
  }

  handleFeedbacksActiveToggle = () => {
    // TODO: trigger mutation instead of updating state
    // TODO: trigger refetch and update values
    this.setState(prevState => ({ feedbacksActive: !prevState.feedbacksActive }))
  }

  handleFeedbacksPublicToggle = () => {
    // TODO: trigger mutation instead of updating state
    // TODO: trigger refetch and update values
    this.setState(prevState => ({ feedbacksPublic: !prevState.feedbacksPublic }))
  }

  handleEndSession = id => async () => {
    try {
      await this.props.endSession({ id })
      Router.push('/questions')
    } catch ({ message }) {
      console.error(message)
    }
  }

  render() {
    const { data, intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      title: intl.formatMessage({
        defaultMessage: 'Running Session',
        id: 'teacher.runningSession.title',
      }),
    }

    if (data.loading) {
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
          Loading
        </TeacherLayout>
      )
    }

    const { runningSession } = data.user

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
              handleRightActionClick={this.handleEndSession(runningSession.id)}
            />
          </div>

          <div className="confusionBarometer">
            <ConfusionBarometer
              intl={intl}
              // data={runningSession.confusion}
              isActive={this.state.confusionActive}
              handleActiveToggle={this.handleConfusionActiveToggle}
            />
          </div>

          <div className="feedbackChannel">
            <FeedbackChannel
              intl={intl}
              data={runningSession.feedbacks}
              isActive={this.state.feedbacksActive}
              isPublic={this.state.feedbacksPublic}
              handleActiveToggle={this.handleFeedbacksActiveToggle}
              handlePublicToggle={this.handleFeedbacksPublicToggle}
            />
          </div>
        </div>

        <style jsx>
          {`
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
          `}
        </style>
      </TeacherLayout>
    )
  }
}

Running.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(RunningSessionQuery),
  graphql(EndSessionMutation, {
    props: ({ mutate }) => ({
      endSession: ({ id }) =>
        mutate({
          refetchQueries: [{ query: RunningSessionQuery }],
          variables: { id },
        }),
    }),
  }),
)(Running)
