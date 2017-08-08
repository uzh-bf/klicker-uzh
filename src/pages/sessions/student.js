// @flow

import React, { Component } from 'react'

import StudentLayout from '../../components/layouts/StudentLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import withData from '../../lib/withData'

class Student extends Component {
  props: {
    intl: $IntlShape,
  }

  state = {}

  render() {
    const { intl } = this.props

    return (
      <StudentLayout intl={intl} >
        <div>hello world</div>

        <style jsx>{`
        `}</style>
      </StudentLayout>
    )
  }
}

export default withData(pageWithIntl(Student))
