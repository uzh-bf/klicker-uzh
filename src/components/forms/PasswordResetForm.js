import React from 'react'
import PropTypes from 'prop-types'
import isLength from 'validator/lib/isLength'
import { Field, reduxForm } from 'redux-form'
import { intlShape } from 'react-intl'

import { FormWithLinks, SemanticInput } from '.'

const validate = ({ password, passwordRepeat }) => {
  const errors = {}

  // password should at least have 7 characters (or more?)
  if (!password || !isLength(password, { max: undefined, min: 7 })) {
    errors.password = 'form.password.invalid'
  }

  // both password fields need to match
  if (!passwordRepeat || passwordRepeat !== password) {
    errors.passwordRepeat = 'form.passwordRepeat.invalid'
  }

  return errors
}

const propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  invalid: PropTypes.bool.isRequired,
}

const PasswordResetForm = ({ intl, invalid, handleSubmit: onSubmit }) => {
  const button = {
    invalid,
    label: intl.formatMessage({
      defaultMessage: 'Submit',
      id: 'form.common.button.submit',
    }),
    onSubmit,
  }
  const links = [
    {
      href: '/user/login',
      label: intl.formatMessage({
        defaultMessage: 'Back to login',
        id: 'form.passwordReset.backToLogin',
      }),
    },
  ]

  return (
    <FormWithLinks button={button} links={links}>
      <Field
        required
        component={SemanticInput}
        errorMessage={intl.formatMessage({
          defaultMessage: 'Please provide a valid password (8+ characters).',
          id: 'form.password.invalid',
        })}
        icon="privacy"
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Password',
          id: 'form.password.label',
        })}
        name="password"
        type="password"
      />
      <Field
        required
        component={SemanticInput}
        errorMessage={intl.formatMessage({
          defaultMessage: 'Please ensure that passwords match.',
          id: 'form.passwordRepeat.invalid',
        })}
        icon="privacy"
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Repeat password',
          id: 'form.passwordRepeat.label',
        })}
        name="passwordRepeat"
        type="password"
      />
    </FormWithLinks>
  )
}

PasswordResetForm.propTypes = propTypes

export default reduxForm({
  form: 'passwordReset',
  validate,
})(PasswordResetForm)
