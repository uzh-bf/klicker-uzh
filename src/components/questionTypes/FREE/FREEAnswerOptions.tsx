// import Slider from 'react-rangeslider'
// import Head from 'next/head'
import _get from 'lodash/get'
import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Input } from 'semantic-ui-react'
// import { createLinks } from '../../../lib/utils/css'
import { QUESTION_TYPES } from '../../../constants'

interface Props {
  disabled?: boolean
  onChange: (value: any) => void
  options?: {
    restrictions: {
      max?: number
      min?: number
      type?: string
    }
  }
  questionType: string
  value?: number | string
}

const defaultProps = {
  disabled: false,
  options: [],
  value: '',
}

function FREEAnswerOptions({ disabled, onChange, options, value, questionType }: Props): React.ReactElement {
  return (
    <div className="ui form freeAnswerOptions">
      {/* <Head>{createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}</Head> */}

      {((): React.ReactElement => {
        if (
          questionType === QUESTION_TYPES.FREE_RANGE &&
          typeof options.restrictions !== 'undefined' &&
          options.restrictions.min !== null &&
          options.restrictions.max !== null
        ) {
          return (
            <div className="field slider">
              <div>
                <strong>
                  <FormattedMessage defaultMessage="Min" id="createQuestion.options.min" />
                </strong>
                : {options.restrictions.min}
              </div>
              <div>
                <strong>
                  <FormattedMessage defaultMessage="Max" id="createQuestion.options.max" />
                </strong>
                : {options.restrictions.max}
              </div>
              {/* <Slider
                disabled={disabled}
                handleLabel={value}
                max={options.restrictions.max}
                min={options.restrictions.min}
                orientation="horizontal"
                tooltip={false}
                value={value}
                onChange={onChange}
              /> */}
              <Input
                disabled={disabled}
                max={options.restrictions.max}
                min={options.restrictions.min}
                type="number"
                value={value}
                onChange={(e): void => onChange(e.target.value)}
              />
            </div>
          )
        }

        return (
          <div className="field">
            {questionType === QUESTION_TYPES.FREE_RANGE && (
              <div className="rangeInformation">
                {((): React.ReactElement => {
                  if (typeof _get(options, 'restrictions.max') !== 'undefined' && options.restrictions.max !== null) {
                    return (
                      <FormattedMessage
                        defaultMessage="Maximum value: {max}"
                        id="freeAnswer.maxValue"
                        values={{ max: options.restrictions.max }}
                      />
                    )
                  }

                  if (typeof _get(options, 'restrictions.min') !== 'undefined' && options.restrictions.min !== null) {
                    return (
                      <FormattedMessage
                        defaultMessage="Minimum value: {min}"
                        id="freeAnswer.minValue"
                        values={{ min: options.restrictions.min }}
                      />
                    )
                  }

                  return (
                    <FormattedMessage defaultMessage="Unrestricted input (any number)" id="freeAnswer.unrestricted" />
                  )
                })()}
              </div>
            )}

            <textarea
              defaultValue=""
              disabled={disabled}
              id="responseInput"
              value={value}
              onChange={(e): void => onChange(e.target.value)}
            />
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
}

FREEAnswerOptions.defaultProps = defaultProps

export default FREEAnswerOptions
