// @flow

import React, { Component } from 'react'
import { graphql } from 'react-apollo'

import { pageWithIntl, withData } from '../../lib'

import ConfusionBarometer from '../../components/confusion/ConfusionBarometer'
import FeedbackChannel from '../../components/feedbacks/FeedbackChannel'
import SessionTimeline from '../../components/sessions/SessionTimeline'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import { RunningSessionQuery } from '../../queries/queries'
import type { RunningSessionType } from '../../queries/queries'

class Running extends Component<{
  data: RunningSessionType,
  intl: $IntlShape,
}, {
  confusionActive: boolean,
  feedbacksActive: boolean,
  feedbacksPublic: boolean,
}> {
  constructor(props) {
    super(props)
    this.state = {
      confusionActive: false,
      feedbacksActive: false,
      feedbacksPublic: false,
    }
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

    // HACK: use the first of all users in the database
    // TODO: replace this with the data of the currently logged in user
    const activeUser = data.allUsers[0]

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
            <SessionTimeline intl={intl} blocks={activeUser.activeSession.blocks} />
          </div>

          <div className="confusionBarometer">
            <ConfusionBarometer
              intl={intl}
              data={activeUser.activeSession.confusion}
              isActive={this.state.confusionActive}
              handleActiveToggle={this.handleConfusionActiveToggle}
            />
          </div>

          <div className="feedbackChannel">
            <FeedbackChannel
              intl={intl}
              data={activeUser.activeSession.feedbacks}
              isActive={this.state.feedbacksActive}
              isPublic={this.state.feedbacksPublic}
              handleActiveToggle={this.handleFeedbacksActiveToggle}
              handlePublicToggle={this.handleFeedbacksPublicToggle}
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

export default withData(pageWithIntl(graphql(RunningSessionQuery)(Running)))
