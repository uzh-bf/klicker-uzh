import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'

// TODO
const propTypes = {
  intl: intlShape.isRequired,
  options: PropTypes.array,
}

// TODO
const defaultProps = {
  options: [],
}

// TODO default value
const Possibilities = ({ intl, options, type }) => (
  <div className="visualization">
    <div className="title">
      <FormattedMessage
        id="teacher.evaluation.possibilities.title"
        defaultMessage="Possibilities"
      />
    </div>
    {console.dir(options)}
    {options &&
      options.map((option, key) => (
        <div className="item">
          <b>{key + 1}</b> {option.text}
        </div>
      ))}
    <style jsx>{`
      .title {
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
