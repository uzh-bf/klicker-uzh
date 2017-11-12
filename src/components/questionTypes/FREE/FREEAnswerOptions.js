import React from 'react'
import PropTypes from 'prop-types'
import Slider from 'react-rangeslider'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'
import { Input } from 'semantic-ui-react'

import { createLinks } from '../../../lib'

const propTypes = {
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.shape({
    restrictions: PropTypes.shape({
      max: PropTypes.number,
      min: PropTypes.number,
      type: PropTypes.string,
    }),
  }),
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}

const defaultProps = {
  disabled: false,
  options: [],
  value: undefined,
}

const FREEAnswerOptions = ({
  disabled, onChange, options, value,
}) => (
  <div className="ui form freeAnswerOptions">
    <Helmet defer={false}>
      {createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}
    </Helmet>

    {(() => {
      if (
        options.restrictions.type === 'RANGE' &&
        options.restrictions.min !== null &&
        options.restrictions.max !== null
      ) {
        return (
          <div className="field slider">
            <span className="min">Min: {options.restrictions.min}</span>
            <span className="max">Max: {options.restrictions.max}</span>
            <Slider
              disabled={disabled}
              min={options.restrictions.min}
              max={options.restrictions.max}
              orientation="horizontal"
              value={value}
              onChange={onChange}
            />
            <Input
              type="number"
              disabled={disabled}
              min={options.restrictions.min}
              max={options.restrictions.max}
              value={value}
              onChange={e => onChange(e.target.value)}
            />
          </div>
        )
      }

      return (
        <div className="field">
          <label htmlFor="responseInput">
            Response
            <textarea
              id="responseInput"
              disabled={disabled}
              onChange={e => onChange(e.target.value)}
            />
          </label>

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
      )
    })()}

    <style jsx>{`
      @import 'src/theme';

      .freeAnswerOptions {
        height: 100%;

        .slider {
          .min,
          .max {
            font-size: 1rem;
          }

          .max {
            float: right;
          }
        }

        textarea {
          min-height: 10rem;
          width: 100%;
        }
      }
    `}</style>
  </div>
)

FREEAnswerOptions.propTypes = propTypes
FREEAnswerOptions.defaultProps = defaultProps

export default FREEAnswerOptions
