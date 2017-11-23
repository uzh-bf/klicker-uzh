import React from 'react'
import PropTypes from 'prop-types'
import Slider from 'react-rangeslider'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'
import { Input } from 'semantic-ui-react'

import { createLinks } from '../../../lib'
import { QUESTION_TYPES } from '../../../constants'

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
  questionType: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
}

const defaultProps = {
  disabled: false,
  options: [],
  value: undefined,
}

const FREEAnswerOptions = ({
  disabled, onChange, options, value, questionType,
}) => (
  <div className="ui form freeAnswerOptions">
    <Helmet defer={false}>
      {createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}
    </Helmet>

    {(() => {
      if (
        questionType === QUESTION_TYPES.FREE_RANGE &&
        options.restrictions.min !== null &&
        options.restrictions.max !== null
      ) {
        return (
          <div className="field slider">
            <span className="min">
              <strong>
                <FormattedMessage defaultMessage="Min" id="teacher.createQuestion.options.min" />
              </strong>: {options.restrictions.min}
            </span>
            <span className="max">
              <strong>
                <FormattedMessage defaultMessage="Max" id="teacher.createQuestion.options.max" />
              </strong>: {options.restrictions.max}
            </span>
            <Slider
              disabled={disabled}
              handleLabel={value}
              max={options.restrictions.max}
              min={options.restrictions.min}
              orientation="horizontal"
              tooltip={false}
              value={value}
              onChange={onChange}
            />
            <Input
              disabled={disabled}
              max={options.restrictions.max}
              min={options.restrictions.min}
              type="number"
              value={value}
              onChange={e => onChange(e.target.value)}
            />
          </div>
        )
      }

      return (
        <div className="field">
          <textarea
            disabled={disabled}
            id="responseInput"
            onChange={e => onChange(e.target.value)}
          />

          {questionType === QUESTION_TYPES.FREE_RANGE && (
            <div>
              {options.FREE_RANGE.restrictions.min !== null && (
                <div>
                  <strong>
                    <FormattedMessage
                      defaultMessage="Min"
                      id="teacher.createQuestion.options.min"
                    />
                  </strong>: {options.restrictions.min}
                </div>
              )}

              {options.FREE_RANGE.restrictions.max !== null && (
                <div>
                  <strong>
                    <FormattedMessage
                      defaultMessage="Max"
                      id="teacher.createQuestion.options.max"
                    />
                  </strong>: {options.restrictions.max}
                </div>
              )}
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

        :global(.rangeslider__fill) {
          background-color: $color-primary;
        }

        :global(.rangeslider__handle) {
          padding: 1rem;

          &:after {
            display: none;
          }

          &:focus {
            outline: none;
          }
        }

        :global(.rangeslider__handle-label) {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate3d(-50%, -50%, 0);
        }
      }
    `}</style>
  </div>
)

FREEAnswerOptions.propTypes = propTypes
FREEAnswerOptions.defaultProps = defaultProps

export default FREEAnswerOptions
