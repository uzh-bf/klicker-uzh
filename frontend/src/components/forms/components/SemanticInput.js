/* eslint-disable jsx-a11y/label-has-for */

import React from 'react'
import PropTypes from 'prop-types'
import { Form, Icon } from 'semantic-ui-react'
import { intlShape, FormattedMessage } from 'react-intl'

const propTypes = {
  disabled: PropTypes.bool,
  input: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
  label: PropTypes.string,
  meta: PropTypes.shape({
    error: PropTypes.string,
    invalid: PropTypes.bool,
    touched: PropTypes.bool,
  }).isRequired,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  width: PropTypes.number,
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
}) => {
  // construct field props
  // define an erroneous field as a field that has been touched and is invalid
  const fieldProps = {
    disabled,
    error: touched && invalid,
    required,
    width,
  }

  // construct input props
  // define the default placeholder to be equal to the label
  const inputProps = { placeholder: label, ...rest }

  const showError = touched && invalid && error

  return (
    <Form.Field {...fieldProps}>
      {label && <label forHtml={input.name}>{label}</label>}

      <input {...input} {...inputProps} />

      {showError && (
        <div className="errorMessage">
          <Icon name="hand pointer" />
          <FormattedMessage id={error} />
        </div>
      )}

      <style jsx>{`
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
      `}</style>
    </Form.Field>
  )
}

SemanticInput.propTypes = propTypes
SemanticInput.defaultProps = defaultProps

export default SemanticInput
