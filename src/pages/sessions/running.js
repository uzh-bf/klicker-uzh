import React, { Component } from 'react'
import PropTypes from 'prop-types'

import ConfusionBarometer from '../../components/sessions/activeSession/ConfusionBarometer'
import FeedbackChannel from '../../components/sessions/activeSession/FeedbackChannel'
import SessionProgress from '../../components/sessions/activeSession/SessionProgress'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import pageWithIntl from '../../lib/pageWithIntl'

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
    const { intl } = this.props

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
          <div className="sessionProgress"><SessionProgress /></div>
          <div className="feedback">
            <div className="confusionBarometer">
              <ConfusionBarometer />
            </div>
            <div className="feedbackChannel">
              <FeedbackChannel />
            </div>
          </div>
        </div>

        <style jsx>{`
        .runningSession {
          display: flex;
          flex-flow: row;
          margin: 1rem 5rem
        }
        .sessionProgress {
          background: red;
          flex: 1;
          padding: 0.5rem
        }
        .feedback {
          flex: 1;
        }
        .feedback > .confusionBarometer {
           background: green;
           flex: 0 0 50%;
           padding: 0.5rem
        }
        .feedback > .feedbackChannel {
           background: blue;
           flex: 0 0 50%;
           padding: 0.5rem
        }
      `}</style>
      </TeacherLayout>
    )
  }
}

export default pageWithIntl(Running)
