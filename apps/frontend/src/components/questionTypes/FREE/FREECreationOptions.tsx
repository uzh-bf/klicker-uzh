import React from 'react'
import _get from 'lodash/get'
import { Form, Icon, Input } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { QUESTION_TYPES } from '../../../constants'
import CustomTooltip from '../../common/CustomTooltip'

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
  dirty: false,
  invalid: undefined,
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

  return (
    <div>
      {type === QUESTION_TYPES.FREE_RANGE && (
        <Form.Field required error={dirty && invalid}>
          <label className="!text-xl" htmlFor="options">
            <FormattedMessage defaultMessage="Input Restrictions" id="createQuestion.optionsFREE.label" />

            <CustomTooltip
              tooltip={
                <FormattedMessage
                  defaultMessage="Choose the allowed format of incoming responses."
                  id="createQuestion.optionsFREE.tooltip"
                />
              }
              tooltipStyle={'text-sm md:text-base max-w-[80%] md:max-w-full'}
              withArrow={false}
            >
              <Icon className="!ml-2" color="blue" name="question circle" />
            </CustomTooltip>
          </label>

          {/* type === QUESTION_TYPES.FREE && <div>Unrestricted input.</div> */}

          <div className="flex flex-col mt-4 md:flex-row">
            <Form.Field className="!w-40 !mr-4">
              <label className="!text-lg" htmlFor="min">
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

            <Form.Field className="!w-40">
              <label className="!text-lg" htmlFor="max">
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
    </div>
  )
}

FREECreationOptions.defaultProps = defaultProps

export default FREECreationOptions
