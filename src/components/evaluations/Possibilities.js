import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

// TODO
const propTypes = {
  options: PropTypes.array,
}

// TODO
const defaultProps = {
  options: [],
}

// TODO default value
const Possibilities = ({ options, type }) => (
  <div className="visualization">
    <h2>
      <FormattedMessage
        id="teacher.evaluation.possibilities.title"
        defaultMessage="Possibilities"
      />
    </h2>

    {options.map((option, index) => (
      <div className="item">
        <b>{index + 1}</b> {option.name}
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
