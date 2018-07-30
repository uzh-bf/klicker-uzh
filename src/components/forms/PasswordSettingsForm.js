import React from 'react'
import PropTypes from 'prop-types'
import isEmail from 'validator/lib/isEmail'
import { Field, reduxForm } from 'redux-form'
import { intlShape } from 'react-intl'
import { Form } from 'semantic-ui-react'

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
        defaultMessage: 'Set new Password',
        id: 'form.settings.password.title',
      })}
    >
      <Form.Group widths="equal">
        <Field
          required
          component={SemanticInput}
          icon="key"
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'New Password',
            id: 'form.password.label',
          })}
          name="password"
          type="password"
        />
        <Field
          required
          component={SemanticInput}
          icon="key"
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'Repeated',
            id: 'form.passwordRepeated.label',
          })}
          name="passwordRepeated"
          type="password"
        />
      </Form.Group>
    </SettingsForm>
  )
}

PasswordSettingsForm.propTypes = propTypes

export default reduxForm({
  form: 'generalSettings',
  validate,
})(PasswordSettingsForm)
