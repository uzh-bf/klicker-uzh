// @flow

import React, { Component } from 'react'

import StudentLayout from '../../components/layouts/StudentLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import withData from '../../lib/withData'

class FeedbackChannel extends Component {
  props: {
    intl: $IntlShape,
  }

  state = {}

  render() {
    const { intl } = this.props

    return (
      <StudentLayout
        intl={intl}
        sidebar={{ activeItem: 'feedbackChannel' }}
        title={intl.formatMessage({
          defaultMessage: 'Feedback-Channel',
          id: 'student.feedbackChannel.title',
        })}
      >
        <div className="feedbackChannel">
          hello world
        </div>

        <style jsx>{`
          .feedbackChannel {
            display: flex;
            flex-direction: column;
          }
        `}</style>
      </StudentLayout>
    )
  }
}

export default withData(pageWithIntl(FeedbackChannel))
