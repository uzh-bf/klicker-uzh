// @flow
/* eslint-disable jsx-a11y/label-has-for */

import * as React from 'react'
import { Form, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

type Props = {
  disabled: boolean,
  input: {
    name: string,
    value: string,
    onBlur: () => mixed,
    onChange: () => mixed,
    onDragStart: () => mixed,
    onDrop: () => mixed,
    onFocus: () => mixed,
  },
  intl: $IntlShape,
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
  placeholder: string,
  required: boolean,
  width: number,
}

const defaultProps = {
  disabled: false,
  label: undefined,
  placeholder: undefined,
  required: false,
  width: undefined,
}

const SemanticInput = ({
  disabled,
  input,
  intl,
  label,
  meta: { error, invalid, touched },
  placeholder,
  required,
  width,
  ...rest
}: Props) => {
  // construct field props
  // define an erroneous field as a field that has been touched and is invalid
  const fieldProps = { disabled, error: touched && invalid, required, width }

  // construct input props
  // define the default placeholder to be equal to the label
  const inputProps = { placeholder: label, ...rest }

  return (
    <Form.Field {...fieldProps}>
      {label &&
        <label forHtml={input.name}>
          {label}
        </label>}

      <input {...input} {...inputProps} />

      {touched &&
        invalid &&
        error &&
        <div className="errorMessage">
          <Icon name="hand pointer" />
          <FormattedMessage id={error} />
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
