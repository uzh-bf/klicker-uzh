// @flow

import React from 'react'

import { withData, pageWithIntl } from '../../lib'

import StaticLayout from '../../components/layouts/StaticLayout'

class Registration extends React.Component {
  props: {
    intl: $IntlShape,
  }

  state: {}

  constructor(props) {
    super(props)
    this.state = {}
  }

  render() {
    const { intl } = this.props

    return (
      <StaticLayout>
        <div className="registration">
          hello world
          <style jsx>{`
            .registration {
              display: flex;
            }
          `}</style>
        </div>
      </StaticLayout>
    )
  }
}

export default withData(pageWithIntl(Registration))
