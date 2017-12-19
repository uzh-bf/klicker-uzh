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

const GeneralSettingsForm = ({ intl, invalid, handleSubmit: onSubmit }) => {
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
        defaultMessage: 'General',
        id: 'form.settings.general.title',
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

GeneralSettingsForm.propTypes = propTypes

export default reduxForm({
  form: 'generalSettings',
  validate,
})(GeneralSettingsForm)
