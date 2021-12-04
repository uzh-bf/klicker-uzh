import React from 'react'
import _get from 'lodash/get'
import { Form, Icon, Input, Popup } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { QUESTION_TYPES } from '../../../constants'

interface Props {
  dirty?: boolean
  disabled?: boolean
  invalid?: boolean
  type: string
  value: any
  onChange: any
}

const defaultProps = {
  disabled: false,
}

function FREECreationOptions({ disabled, type, dirty, invalid, value, onChange }: Props): React.ReactElement {
  const max = _get(value, 'restrictions.max')
  const min = _get(value, 'restrictions.min')

  // handle a change in the maximum allowed numerical value
  const onMaxChange = (e): void => {
    const newMax = e.target.value === '' ? null : +e.target.value
    onChange({
      ...value,
      restrictions: { ...value.restrictions, max: newMax },
    })
  }

  // handle a change in the minimum allowed numerical value
  const onMinChange = (e): void => {
    const newMin = e.target.value === '' ? null : +e.target.value
    onChange({
      ...value,
      restrictions: { ...value.restrictions, min: newMin },
    })
  }
  const PopupStyle = { opacity: 0.9 }

  return (
    <div className="FREECreationOptions">
      {type === QUESTION_TYPES.FREE_RANGE && (
        <Form.Field required error={dirty && invalid}>
          <label htmlFor="options">
            <FormattedMessage defaultMessage="Input Restrictions" id="createQuestion.optionsFREE.label" />

            <Popup
              content={
                <FormattedMessage
                  defaultMessage="Choose the allowed format of incoming responses."
                  id="createQuestion.optionsFREE.tooltip"
                />
              }
              trigger={
                <a data-tip>
                  <Icon name="question circle" />
                </a>
              }
              position="right center"
              size="small"
              style={PopupStyle}
              mouseEnterDelay={250}
              mouseLeaveDelay={250}
              wide
              inverted
            />
          </label>

          {/* type === QUESTION_TYPES.FREE && <div>Unrestricted input.</div> */}

          <div className="range">
            <Form.Field>
              <label htmlFor="min">
                <FormattedMessage defaultMessage="Min" id="createQuestion.options.min" />
              </label>
              <Input
                disabled={disabled}
                name="min"
                placeholder="-inf"
                type="number"
                value={min}
                onChange={onMinChange}
              />
            </Form.Field>

            <Form.Field>
              <label htmlFor="max">
                <FormattedMessage defaultMessage="Max" id="createQuestion.options.max" />
              </label>
              <Input
                disabled={disabled}
                name="max"
                placeholder="+inf"
                type="number"
                value={max}
                onChange={onMaxChange}
              />
            </Form.Field>
          </div>
        </Form.Field>
      )}

      <style jsx>{`
        @import 'src/theme';

        .FREECreationOptions {
          @include tooltip-icon;

          .optionsChooser {
            display: flex;

            > :global(*):not(:last-child) {
              margin-right: 1rem;
            }
          }

          .range {
            display: flex;
            flex-direction: column;

            margin-top: 1rem;

            :global(.field) > label {
              font-size: 1rem;
            }

            @include desktop-tablet-only {
              flex-direction: row;

              :global(.field) {
                width: 10rem;

                &:not(:last-child) {
                  margin-right: 1rem;
                }
              }
            }
          }
        }
      `}</style>
    </div>
  )
}

FREECreationOptions.defaultProps = defaultProps

export default FREECreationOptions
