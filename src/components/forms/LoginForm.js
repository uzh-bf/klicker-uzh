import React from 'react'
import PropTypes from 'prop-types'
import isEmail from 'validator/lib/isEmail'
import isLength from 'validator/lib/isLength'
import { intlShape } from 'react-intl'
import { Formik } from 'formik'

import { FormWithLinks, FormikInput } from '.'

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

const propTypes = {
  intl: intlShape.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const LoginForm = ({ intl, onSubmit }) => {
  const links = [
    {
      href: '/user/requestPassword',
      label: intl.formatMessage({
        defaultMessage: 'Forgot password?',
        id: 'form.forgotPassword.label',
      }),
    },
    /* { TODO: enable AAI button
      href: '/user/aaiLogin',
      label: intl.formatMessage({ defaultMessage: 'Login with AAI', id: 'form.aaiLogin.label' }),
    }, */
  ]

  /* return (
    <FormWithLinks button={button} links={links}>
      <Field
        autoFocus
        required
        component={SemanticInput}
        errorMessage={intl.formatMessage({
          defaultMessage: 'Please provide a valid email address.',
          id: 'form.email.invalid',
        })}
        icon="mail"
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
    </FormWithLinks>
  ) */
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
            disabled: isSubmitting,
            label: intl.formatMessage({
              defaultMessage: 'Submit',
              id: 'form.common.button.submit',
            }),
            onSubmit: handleSubmit,
          }}
          links={links}
        >
          <FormikInput
            autoFocus
            required
            error={errors.email}
            errorMessage={intl.formatMessage({
              defaultMessage: 'Please provide a valid email address.',
              id: 'form.email.invalid',
            })}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="mail"
            intl={intl}
            label={intl.formatMessage({
              defaultMessage: 'Email',
              id: 'form.email.label',
            })}
            name="email"
            touched={touched.email}
            type="email"
            value={values.email}
          />
          <FormikInput
            required
            error={errors.password}
            errorMessage={intl.formatMessage({
              defaultMessage: 'Please provide a valid password (8+ characters).',
              id: 'form.password.invalid',
            })}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="privacy"
            intl={intl}
            label={intl.formatMessage({
              defaultMessage: 'Password',
              id: 'form.password.label',
            })}
            name="password"
            touched={touched.password}
            type="password"
            value={values.password}
          />
        </FormWithLinks>
      )}
      validate={validate}
      onSubmit={onSubmit}
    />
  )
}

LoginForm.propTypes = propTypes

export default LoginForm
