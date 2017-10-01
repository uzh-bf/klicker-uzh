// @flow

import * as React from 'react'
import isEmail from 'validator/lib/isEmail'
import isLength from 'validator/lib/isLength'
import { Field, reduxForm } from 'redux-form'

import { FormWithLinks, SemanticInput } from './components'

type Props = {
  intl: any,
  invalid: boolean,
  handleSubmit: (values: {
    email: string,
    password: string,
  }) => mixed,
}

const validate = ({ email, password }) => {
  const errors = {}

  // the email address needs to be valid
  if (!email || !isEmail(email)) {
    errors.email = 'form.email.invalid'
  }

  // password should at least have 7 characters (or more?)
  if (!password || !isLength(password, { max: undefined, min: 1 })) {
    errors.password = 'form.password.invalid'
  }

  return errors
}

const LoginForm = ({ intl, invalid, handleSubmit: onSubmit }: Props) => {
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
      href: '/user/resetPassword',
      label: intl.formatMessage({
        defaultMessage: 'Forgot password?',
        id: 'form.forgotPassword.label',
      }),
    },
    {
      href: '/user/aaiLogin',
      label: intl.formatMessage({ defaultMessage: 'Login with AAI', id: 'form.aaiLogin.label' }),
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
      <Field
        required
        component={SemanticInput}
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Password',
          id: 'form.password.label',
        })}
        name="password"
        type="password"
      />
    </FormWithLinks>
  )
}

export default reduxForm({
  form: 'login',
  validate,
})(LoginForm)
