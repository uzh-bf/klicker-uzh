import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'

import ConfusionBarometer from '../../components/confusion/ConfusionBarometer'
import FeedbackChannel from '../../components/feedbacks/FeedbackChannel'
import SessionTimeline from '../../components/sessions/SessionTimeline'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import { RunningSessionQuery } from '../../queries/queries'
import withData from '../../lib/withData'

class Running extends Component {
  static propTypes = {
    intl: PropTypes.shape({
      formatMessage: PropTypes.func.isRequired,
    }).isRequired,
  }

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

  render() {
    const { data, intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      title: intl.formatMessage({
        defaultMessage: 'Running Session',
        id: 'pages.runningSession.title',
      }),
    }

    if (data.loading) {
      return (
        <TeacherLayout intl={intl} navbar={navbarConfig} sidebar={{ activeItem: 'runningSession' }}>
          Loading
        </TeacherLayout>
      )
    }

    // HACK: use the first of all users in the database
    // TODO: replace this with the data of the currently logged in user
    const activeUser = data.allUsers[0]

    return (
      <TeacherLayout intl={intl} navbar={navbarConfig} sidebar={{ activeItem: 'runningSession' }}>
        <div className="runningSession">
          <div className="sessionProgress">
            <SessionTimeline intl={intl} blocks={activeUser.activeSession.blocks} />
          </div>

          <div className="confusionBarometer">
            <ConfusionBarometer
              intl={intl}
              data={activeUser.activeSession.confusion}
              isActive={this.state.confusionActive}
              onActiveToggle={this.handleConfusionActiveToggle}
            />
          </div>

          <div className="feedbackChannel">
            <FeedbackChannel
              intl={intl}
              data={activeUser.activeSession.feedbacks}
              isActive={this.state.feedbacksActive}
              isPublic={this.state.feedbacksPublic}
              onActiveToggle={this.handleFeedbacksActiveToggle}
              onPublicToggle={this.handleFeedbacksPublicToggle}
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
              padding: .5rem;
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
}

Running.propTypes = {
  data: PropTypes.shape({
    allUsers: PropTypes.arrayOf({
      activeSession: PropTypes.shape({
        blocks: PropTypes.arrayOf({
          questions: PropTypes.arrayOf({
            questionDefinition: PropTypes.shape({
              title: PropTypes.string,
              type: PropTypes.string,
            }),
          }),
          status: PropTypes.string,
        }),
        confusion: PropTypes.arrayOf({
          comprehensibility: PropTypes.number,
          createdAt: PropTypes.string,
          difficulty: PropTypes.number,
        }),
        feedbacks: PropTypes.arrayOf({
          content: PropTypes.string,
          id: PropTypes.string,
          votes: PropTypes.number,
        }),
      }),
    }),
  }).isRequired,
}

export default withData(pageWithIntl(graphql(RunningSessionQuery)(Running)))
