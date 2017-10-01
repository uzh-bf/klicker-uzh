// @flow

import * as React from 'react'
import isEmail from 'validator/lib/isEmail'
import { Field, reduxForm } from 'redux-form'

import { FormWithLinks, SemanticInput } from './components'

type Props = {
  intl: any,
  invalid: boolean,
  handleSubmit: (values: {
    email: string,
  }) => mixed,
}

const validate = ({ email }) => {
  const errors = {}

  // the email address needs to be valid
  if (!email || !isEmail(email)) {
    errors.email = 'form.common.email.invalid'
  }

  return errors
}

const PasswordResetForm = ({ intl, invalid, handleSubmit: onSubmit }: Props) => {
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
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Email',
          id: 'form.email.label',
        })}
        name="email"
        type="email"
      />
    </FormWithLinks>
  )
}

export default reduxForm({
  form: 'passwordReset',
  validate,
})(PasswordResetForm)
