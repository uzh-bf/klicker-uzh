// @flow

import React, { Component } from 'react'

import StudentLayout from '../../components/layouts/StudentLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import withData from '../../lib/withData'

class ActiveQuestion extends Component {
  props: {
    intl: $IntlShape,
  }

  state = {}

  render() {
    const { intl } = this.props

    return (
      <StudentLayout
        intl={intl}
        sidebar={{ activeItem: 'activeQuestion' }}
        title={intl.formatMessage({
          defaultMessage: 'Active Question',
          id: 'student.activeQuestion.title',
        })}
      >
        <div>hello world</div>
      </StudentLayout>
    )
  }
}

export default withData(pageWithIntl(ActiveQuestion))
