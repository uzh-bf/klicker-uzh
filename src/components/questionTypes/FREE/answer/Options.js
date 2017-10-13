import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  options: PropTypes.shape({
    restrictions: PropTypes.shape({
      max: PropTypes.number,
      min: PropTypes.number,
      type: PropTypes.string,
    }),
  }),
}

const defaultProps = {
  options: [],
}

const Options = ({ options }) => (
  <div className="options">
    {options.restrictions.type === 'NUMBERS' &&
    options.restrictions.min !== null &&
    options.restrictions.max !== null ? (
      <div>Slider {/* TODO Slider */}</div>
    ) : (
      <div>
        <textarea />
        {options.restrictions.min !== null && (
          <div>
            <FormattedMessage defaultMessage="Min" id="teacher.createQuestion.options.min" />:{' '}
            {options.restrictions.min}
          </div>
        )}
        {options.restrictions.max !== null && (
          <div>
            <FormattedMessage defaultMessage="Max" id="teacher.createQuestion.options.max" />:{' '}
            {options.restrictions.max}
          </div>
        )}
      </div>
    )}
  </div>
)

Options.propTypes = propTypes
Options.defaultProps = defaultProps

export default Options
