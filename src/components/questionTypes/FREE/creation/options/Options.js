// @flow

import React from 'react'
import { FormattedMessage } from 'react-intl'

class Options extends React.Component {
  static defaultProps = {
    input: {
      value: [],
    },
  }

  render() {
    return (
      <div className="field">
        <label htmlFor="options">
          <FormattedMessage defaultMessage="Options" id="teacher.createQuestion.options" />
        </label>
      </div>
    )
  }
}

export default Options
