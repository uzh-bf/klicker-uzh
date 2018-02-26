/* eslint-disable jsx-a11y/label-has-for */

import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Form, Icon, Input } from 'semantic-ui-react'

const propTypes = {
  disabled: PropTypes.bool,
  errorMessage: PropTypes.string,
  inlineLabel: PropTypes.string,
  input: PropTypes.object.isRequired,
  label: PropTypes.string,
  meta: PropTypes.shape({
    error: PropTypes.string,
    invalid: PropTypes.bool,
    touched: PropTypes.bool,
  }).isRequired,
  placeholder: PropTypes.string,
  renderInput: PropTypes.func,
  required: PropTypes.bool,
  tooltip: PropTypes.string,
  width: PropTypes.number,
}

const defaultProps = {
  disabled: false,
  errorMessage: undefined,
  inlineLabel: undefined,
  label: undefined,
  placeholder: undefined,
  renderInput: undefined,
  required: false,
  tooltip: undefined,
  width: undefined,
}

const FormikInput = ({
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
}) => {
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
  const inputProps = { label: inlineLabel, placeholder: placeholder || label, ...rest }
  const showError = touched && !!error

  return (
    <Form.Field {...fieldProps}>
      {label && (
        <label forHtml={name}>
          {label}
          {tooltip && (
            <a data-tip data-for={name}>
              <Icon className="icon" name="question circle" />
            </a>
          )}
        </label>
      )}

      <Input
        name={name}
        value={value}
        {...inputProps}
        onBlur={handleBlur}
        onChange={handleChange}
      />

      {tooltip && (
        <ReactTooltip delayHide={250} delayShow={250} id={name} place="right">
          {tooltip}
        </ReactTooltip>
      )}

      {showError &&
        errorMessage && (
          <div className="errorMessage">
            <Icon name="hand pointer" />
            {errorMessage}
          </div>
        )}

      <style jsx>{`
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
      `}</style>
    </Form.Field>
  )
}

FormikInput.propTypes = propTypes
FormikInput.defaultProps = defaultProps

export default FormikInput
