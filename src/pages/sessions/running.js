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
          <div>
            <div>
              Confusion Barometer
            </div>
            <div>
              Feedback-Channel
            </div>
          </div>
        </div>

        <style jsx>{`
        .runningSession {
          margin: .5rem 10rem
        }
        .runningSession, .sessionProgress {
          display: flex;
          flex-direction: column;
          flex-flow: row wrap
        }
      `}</style>
      </TeacherLayout>
    )
  }
}

export default pageWithIntl(Running)
