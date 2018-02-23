import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { Formik } from 'formik'
import Yup from 'yup'
import _isEmpty from 'lodash/isEmpty'

import { FormWithLinks, FormikInput } from '.'

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
            disabled: isSubmitting || !_isEmpty(errors) || _isEmpty(touched),
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
