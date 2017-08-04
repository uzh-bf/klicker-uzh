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

    return (
      <TeacherLayout intl={intl} navbar={navbarConfig} sidebar={{ activeItem: 'runningSession' }}>
        <div className="runningSession">
          <div className="sessionProgress"><SessionProgress data={data.allUsers[0].activeSession.blocks} intl={intl} /></div>
          <div className="feedback">
            <div className="confusionBarometer">
              <ConfusionBarometer data={data.allUsers[0].activeSession.confusion} intl={intl} />
            </div>
            <div className="feedbackChannel">
              <FeedbackChannel data={data.allUsers[0].activeSession.feedbacks} intl={intl} />
            </div>
          </div>
        </div>

        <style jsx>{`
        .runningSession {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          margin: 1rem 6rem
        }
        .sessionProgress {
          flex: 1 1 100%;
          padding: 0.5rem
        }
        .feedback {
          display: flex;
          flex-flow: row wrap;
          flex: 0 0 100%;
        }
        .feedback > .confusionBarometer {
           flex: 0 0 30%;
           padding: 0.5rem
        }
        .feedback > .feedbackChannel {
           flex: 0 0 70%;
           padding: 0.5rem
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
