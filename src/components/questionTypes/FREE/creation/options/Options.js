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
        <button
          className={'noLimitations'}
          type="button"
        >
          <FormattedMessage
            defaultMessage="No Limitations"
            id="teacher.createQuestion.options.noLimitations"
          />
        </button>
        <button
          className={'noLimitations'}
          type="button"
        >
          <FormattedMessage
            defaultMessage="Number Range"
            id="teacher.createQuestion.options.numberRange"
          />
        </button>

        <style jsx>{`
          button {
            background-color: white;
            border: 1px solid lightgrey;
            cursor: pointer;
            padding: 1rem;
            outline: none;
          }

          button.active {
            border-color: orange;
          }

          button:not(:last-child) {
            margin-bottom: 0.5rem;
          }
        `}</style>
      </div>
    )
  }
}

export default Options
