// @flow
/* eslint-disable jsx-a11y/label-has-for */

import React from 'react'
import { Form, Icon } from 'semantic-ui-react'

type Props = {
  disabled?: boolean,
  error?: boolean,
  input: {
    name: string,
    value: string,
    onBlur: () => mixed,
    onChange: () => mixed,
    onDragStart: () => mixed,
    onDrop: () => mixed,
    onFocus: () => mixed,
  },
  intl?: $IntlShape,
  label: string,
  meta: {
    active: boolean,
    asyncValidating: boolean,
    autofilled: boolean,
    dirty: boolean,
    error: ?string,
    form: string,
    initial: ?string,
    invalid: boolean,
    pristine: boolean,
    submitFailed: boolean,
    submitting: boolean,
    touched: boolean,
    valid: boolean,
    visited: boolean,
    warning: ?string,
    dispatch: () => mixed,
  },
  placeholder?: string,
  required?: boolean,
  width?: number,
}

const defaultProps = {
  disabled: false,
  error: undefined,
  intl: undefined,
  placeholder: undefined,
  required: false,
  width: undefined,
}

const SemanticInput = ({
  disabled,
  error,
  input,
  intl,
  label,
  meta: { error: metaError, invalid, touched },
  placeholder,
  required,
  width,
  ...rest
}: Props) => {
  // translate the label if intl was injected. otherwise use it directly.
  const inputLabel = intl ? intl.formatMessage({ id: label }) : label

  // calculate the error message
  const errorContent = error || metaError
  const errorMessage = intl ? intl.formatMessage({ id: errorContent }) : errorContent

  // construct field props
  const fieldProps = { disabled, error: error || (touched && metaError), required, width }

  return (
    <Form.Field {...fieldProps}>
      {label &&
        <label forHtml={input.name}>
          {inputLabel}
        </label>}

      <input {...input} {...rest} placeholder={placeholder || inputLabel} />

      {touched &&
        invalid &&
        <div className="errorMessage">
          <Icon name="hand pointer" />
          {errorMessage}
        </div>}

      <style jsx>{`
        .errorMessage {
          // TODO: improve styling
          background-color: #fff6f6;
          border: 1px solid #e0b4b4;
          border-top: none;
          box-shadow: 2px 2px 3px 0px rgba(0, 0, 0, 0.05);
          color: #9f3a38;
          font-size: .9rem;
          padding: .3rem .5rem;
        }
      `}</style>
    </Form.Field>
  )
}

SemanticInput.defaultProps = defaultProps

export default SemanticInput
