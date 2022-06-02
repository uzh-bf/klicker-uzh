/* eslint-disable jsx-a11y/label-has-for */

import React from 'react'
import { Form, Icon, Input } from 'semantic-ui-react'
import { FormikErrors, FormikTouched } from 'formik'
import SemanticCustomTooltip from '../../common/SemanticCustomTooltip'

interface Props {
  action?: any
  actionPosition?: any
  autoFocus?: boolean
  disabled?: boolean
  error?: string | string[] | FormikErrors<any> | FormikErrors<any>[]
  errorMessage?: string
  handleBlur: any
  handleChange: any
  icon?: string
  inlineLabel?: string
  label?: string
  labelPosition?: 'left' | 'right' | 'left corner' | 'right corner'
  min?: number
  max?: number
  name: string
  placeholder?: string
  renderInput?: () => React.ReactElement
  required?: boolean
  tooltip?: string | React.ReactElement
  touched: boolean | FormikTouched<any> | FormikTouched<any>[]
  type?: string
  value: string | number
  width?: any // SemanticWIDTHSNUMBER
}

const defaultProps = {
  disabled: false,
  error: undefined,
  errorMessage: undefined,
  inlineLabel: undefined,
  label: undefined,
  placeholder: undefined,
  renderInput: undefined,
  required: false,
  tooltip: undefined,
  width: undefined,
}

function FormikInput({
  // formik props
  value,
  error,
  touched,
  handleChange,
  handleBlur,
  // own props
  name,
  label,
  inlineLabel,
  placeholder,
  disabled,
  required,
  width,
  tooltip,
  errorMessage,
  // remaining props
  ...rest
}: Props): React.ReactElement {
  // construct field props
  // define an erroneous field as a field that has been touched and is invalid
  const fieldProps = {
    disabled,
    error: touched && !!error,
    required,
    width,
  }

  // construct input props
  // define the default placeholder to be equal to the label
  const inputProps = {
    label: inlineLabel,
    placeholder: placeholder || label,
    ...rest,
  }
  const showError = touched && !!error

  return (
    <Form.Field {...fieldProps}>
      {label && (
        <label htmlFor={name}>
          {label}
          {tooltip && (
            <SemanticCustomTooltip
              className={'!ml-2'}
              content={tooltip}
              trigger={
                <a data-tip>
                  <Icon className="icon" name="question circle" />
                </a>
              }
            />
          )}
        </label>
      )}

      <Input name={name} value={value} {...inputProps} onBlur={handleBlur} onChange={handleChange} />

      {showError && errorMessage && (
        <div className="errorMessage">
          <Icon name="hand pointer" />
          {errorMessage}
        </div>
      )}

      <style jsx>
        {`
          @import 'src/theme';

          @include tooltip-icon;

          .errorMessage {
            // TODO: improve styling
            background-color: #fff6f6;
            border: 1px solid #e0b4b4;
            border-top: none;
            box-shadow: 2px 2px 3px 0px rgba(0, 0, 0, 0.05);
            color: #9f3a38;
            font-size: 0.9rem;
            padding: 0.3rem 0.5rem;
          }
        `}
      </style>
    </Form.Field>
  )
}

FormikInput.defaultProps = defaultProps

export default FormikInput
