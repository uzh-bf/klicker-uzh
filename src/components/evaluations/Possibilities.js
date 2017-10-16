import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

// TODO
const propTypes = {
  choices: PropTypes.array,
}

// TODO
const defaultProps = {
  choices: [],
}

// TODO default value
const Possibilities = ({ choices, type }) => (
  <div className="visualization">
    {choices.map((choice, index) => (
      <div className="item">
        <b>{index + 1}</b> {choice.name}
      </div>
    ))}
    <style jsx>{`
      h2 {
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .item {
        padding: 0.3rem 0;
      }
    `}</style>
  </div>
)

Possibilities.propTypes = propTypes
Possibilities.defaultProps = defaultProps

export default Possibilities
