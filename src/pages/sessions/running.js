import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'

import ConfusionBarometer from '../../components/sessions/activeSession/confusion/ConfusionBarometer'
import FeedbackChannel from '../../components/sessions/activeSession/feedback/FeedbackChannel'
import SessionProgress from '../../components/sessions/activeSession/SessionProgress'
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

  handleSidebarToggle = () => {
    this.setState({ sidebarVisible: !this.state.sidebarVisible })
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

    // HACK: use the first of all users in the database
    // TODO: replace this with the data of the currently logged in user
    const activeUser = data.allUsers[0]

    return (
      <TeacherLayout intl={intl} navbar={navbarConfig} sidebar={{ activeItem: 'runningSession' }}>
        <div className="runningSession">
          <div className="sessionProgress">
            <SessionProgress data={activeUser.activeSession.blocks} intl={intl} />
          </div>
          <div className="confusionBarometer">
            <ConfusionBarometer data={activeUser.activeSession.confusion} intl={intl} />
          </div>
          <div className="feedbackChannel">
            <FeedbackChannel data={activeUser.activeSession.feedbacks} intl={intl} />
          </div>
        </div>

        <style jsx>{`
          .runningSession {
            display: flex;
            flex-flow: row wrap;
            margin: 1rem 6rem;
          }
          .sessionProgress {
            flex: 0 0 100%;
            padding: 0.5rem;
          }
          .confusionBarometer {
            flex: 0 0 30%;
            padding: 0.5rem;
          }
          .feedbackChannel {
            flex: 0 0 70%;
            padding: 0.5rem;
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
