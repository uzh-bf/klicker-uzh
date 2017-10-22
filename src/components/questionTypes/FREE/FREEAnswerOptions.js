import React from 'react'
import PropTypes from 'prop-types'
import Slider from 'react-rangeslider'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../../lib'

const propTypes = {
  handleChange: PropTypes.func.isRequired,
  options: PropTypes.shape({
    restrictions: PropTypes.shape({
      max: PropTypes.number,
      min: PropTypes.number,
      type: PropTypes.string,
    }),
  }),
  value: PropTypes.number,
}

const defaultProps = {
  options: [],
  value: undefined,
}

const FREEAnswerOptions = ({ handleChange, options, value }) => (
  <div className="options">
    <Helmet defer={false}>
      {createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}
    </Helmet>
    {options.restrictions.type === 'NUMBERS' &&
    options.restrictions.min !== null &&
    options.restrictions.max !== null ? (
      <div className="slider">
        <Slider
          min={options.restrictions.min}
          max={options.restrictions.max}
          orientation="horizontal"
          value={value}
          onChange={handleChange}
        />
      </div>
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

FREEAnswerOptions.propTypes = propTypes
FREEAnswerOptions.defaultProps = defaultProps

export default FREEAnswerOptions
