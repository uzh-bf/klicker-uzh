import React from 'react'
import PropTypes from 'prop-types'
import Slider from 'react-rangeslider'
import { FormattedMessage } from 'react-intl'
import Head from 'next/head'
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

const FREEAnswerOptions = ({ disabled, onChange, options, value, questionType }) => (
  <div className="ui form freeAnswerOptions">
    <Head>{createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}</Head>

    {(() => {
      if (
        questionType === QUESTION_TYPES.FREE_RANGE &&
        typeof options.restrictions !== 'undefined' &&
        options.restrictions.min !== null &&
        options.restrictions.max !== null
      ) {
        return (
          <div className="field slider">
            <span className="min">
              <strong>
                <FormattedMessage defaultMessage="Min" id="createQuestion.options.min" />
              </strong>
              :{options.restrictions.min}
            </span>
            <span className="max">
              <strong>
                <FormattedMessage defaultMessage="Max" id="createQuestion.options.max" />
              </strong>
              :{options.restrictions.max}
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
          <div className="rangeInformation">
            {do {
              if (typeof options.restrictions?.max !== 'undefined' && options.restrictions.max !== null) {
                ;<FormattedMessage
                  defaultMessage="Maximum value: {max}"
                  id="freeAnswer.maxValue"
                  values={{ max: options.restrictions.max }}
                />
              } else if (typeof options.restrictions?.min !== 'undefined' && options.restrictions.min !== null) {
                ;<FormattedMessage
                  defaultMessage="Minimum value: {min}"
                  id="freeAnswer.minValue"
                  values={{ min: options.restrictions.min }}
                />
              } else {
                ;<FormattedMessage defaultMessage="Unrestricted input (any number)" id="freeAnswer.unrestricted" />
              }
            }}
          </div>

          <textarea disabled={disabled} id="responseInput" onChange={e => onChange(e.target.value)} />

          {questionType === QUESTION_TYPES.FREE_RANGE && (
            <div>
              {options.restrictions?.min && (
                <div>
                  <strong>
                    <FormattedMessage defaultMessage="Min" id="createQuestion.options.min" />
                  </strong>
                  :{options.restrictions.min}
                </div>
              )}

              {options.restrictions?.max && (
                <div>
                  <strong>
                    <FormattedMessage defaultMessage="Max" id="createQuestion.options.max" />
                  </strong>
                  :{options.restrictions.max}
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
        .slider {
          .min,
          .max {
            font-size: 1rem;
          }

          .max {
            float: right;
          }
        }

        .rangeInformation {
          margin-bottom: 1rem;
        }

        textarea {
          height: 100%;
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
