import React, { Component } from 'react'
import PropTypes from 'prop-types'

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
          <div className="sessionProgress">Session Progress</div>
          <div className="feedback">
            <div className="confusionBarometer">
              Confusion Barometer
            </div>
            <div className="feedbackChannel">
              Feedback-Channel
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
        }
        .feedback {
          flex: 1;
        }
        .feedback > .confusionBarometer {
           background: green;
           flex: 0 0 50%;
        }
        .feedback > .feedbackChannel {
           background: blue;
           flex: 0 0 50%;
        }
      `}</style>
      </TeacherLayout>
    )
  }
}

export default pageWithIntl(Running)
