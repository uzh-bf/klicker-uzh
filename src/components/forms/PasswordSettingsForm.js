import React from 'react'
import PropTypes from 'prop-types'
import isEmail from 'validator/lib/isEmail'
import { Field, reduxForm } from 'redux-form'
import { intlShape } from 'react-intl'

import { SemanticInput, SettingsForm } from '.'

const validate = ({ email }) => {
  const errors = {}

  // the email address needs to be valid
  if (!email || !isEmail(email)) {
    errors.email = 'form.common.email.invalid'
  }

  return errors
}

const propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const PasswordSettingsForm = ({ intl, invalid, handleSubmit: onSubmit }) => {
  const button = {
    invalid,
    label: intl.formatMessage({
      defaultMessage: 'Submit',
      id: 'form.common.button.submit',
    }),
    onSubmit,
  }

  return (
    <SettingsForm
      button={button}
      sectionTitle={intl.formatMessage({
        defaultMessage: 'Password',
        id: 'form.settings.password.title',
      })}
    >
      <Field
        required
        component={SemanticInput}
        icon="mail"
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Email',
          id: 'form.email.label',
        })}
        name="email"
        type="email"
      />
    </SettingsForm>
  )
}

PasswordSettingsForm.propTypes = propTypes

export default reduxForm({
  form: 'generalSettings',
  validate,
})(PasswordSettingsForm)
