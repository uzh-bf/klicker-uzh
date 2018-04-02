import React from 'react'
import PropTypes from 'prop-types'
import { defineMessages, intlShape } from 'react-intl'
import { Formik } from 'formik'
import Yup from 'yup'
import _isEmpty from 'lodash/isEmpty'

import { FormWithLinks, FormikInput } from '.'

const messages = defineMessages({
  emailInvalid: {
    defaultMessage: 'Please provide a valid email address.',
    id: 'form.email.invalid',
  },
  emailLabel: {
    defaultMessage: 'Email',
    id: 'form.email.label',
  },
  forgotPassword: {
    defaultMessage: 'Forgot password?',
    id: 'form.forgotPassword.label',
  },
  passowrdInvalid: {
    defaultMessage: 'Please provide a valid password (8+ characters).',
    id: 'form.password.invalid',
  },
  passwordLabel: {
    defaultMessage: 'Password',
    id: 'form.password.label',
  },
  submitButton: {
    defaultMessage: 'Submit',
    id: 'form.common.button.submit',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const LoginForm = ({ intl, onSubmit }) => {
  const links = [
    {
      href: '/user/requestPassword',
      label: intl.formatMessage(messages.forgotPassword),
    },
    /* { TODO: enable AAI button
      href: '/user/aaiLogin',
      label: intl.formatMessage({ defaultMessage: 'Login with AAI', id: 'form.aaiLogin.label' }),
    }, */
  ]

  return (
    <Formik
      initialValues={{
        email: '',
        password: '',
      }}
      render={({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
      }) => (
        <FormWithLinks
          button={{
            disabled: !_isEmpty(errors) || _isEmpty(touched),
            label: intl.formatMessage(messages.submitButton),
            loading: isSubmitting,
            onSubmit: handleSubmit,
          }}
          links={links}
        >
          <FormikInput
            autoFocus
            required
            error={errors.email}
            errorMessage={intl.formatMessage(messages.emailInvalid)}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="mail"
            intl={intl}
            label={intl.formatMessage(messages.emailLabel)}
            name="email"
            touched={touched.email}
            type="email"
            value={values.email}
          />
          <FormikInput
            required
            error={errors.password}
            errorMessage={intl.formatMessage(messages.passowrdInvalid)}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="privacy"
            intl={intl}
            label={intl.formatMessage(messages.passwordLabel)}
            name="password"
            touched={touched.password}
            type="password"
            value={values.password}
          />
        </FormWithLinks>
      )}
      validationSchema={Yup.object().shape({
        email: Yup.string()
          .email()
          .required(),
        password: Yup.string().required(),
      })}
      onSubmit={onSubmit}
    />
  )
}

LoginForm.propTypes = propTypes

export default LoginForm
