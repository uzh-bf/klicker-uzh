import React from 'react'
import PropTypes from 'prop-types'
import _isEmpty from 'lodash/isEmpty'
import { defineMessages, intlShape } from 'react-intl'
import { Formik } from 'formik'
import Yup from 'yup'

import { FormWithLinks, FormikInput } from '.'

const messages = defineMessages({
  backToLogin: {
    defaultMessage: 'Back to login',
    id: 'form.passwordReset.backToLogin',
  },
  passwordInvalid: {
    defaultMessage: 'Please provide a valid password (8+ characters).',
    id: 'form.password.invalid',
  },
  passwordLabel: {
    defaultMessage: 'Password',
    id: 'form.password.label',
  },
  passwordRepeatInvalid: {
    defaultMessage: 'Please ensure that passwords match.',
    id: 'form.passwordRepeat.invalid',
  },
  passwordRepeatLabel: {
    defaultMessage: 'Repeat password',
    id: 'form.passwordRepeat.label',
  },
  submit: {
    defaultMessage: 'Submit',
    id: 'form.common.button.submit',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const PasswordResetForm = ({ intl, onSubmit }) => {
  const links = [
    {
      href: '/user/login',
      label: intl.formatMessage(messages.backToLogin),
    },
  ]

  return (
    <Formik
      initialValues={{
        password: '',
        passwordRepeat: '',
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
            label: intl.formatMessage(messages.submit),
            loading: isSubmitting,
            onSubmit: handleSubmit,
          }}
          links={links}
        >
          <FormikInput
            autoFocus
            required
            error={errors.password}
            errorMessage={intl.formatMessage(messages.passwordInvalid)}
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
          <FormikInput
            required
            error={errors.passwordRepeat}
            errorMessage={intl.formatMessage(messages.passwordRepeatInvalid)}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="privacy"
            intl={intl}
            label={intl.formatMessage(messages.passwordRepeatLabel)}
            name="passwordRepeat"
            touched={touched.passwordRepeat}
            type="password"
            value={values.passwordRepeat}
          />
        </FormWithLinks>
      )}
      validationSchema={Yup.object().shape({
        password: Yup.string()
          .min(8)
          .required(),
        passwordRepeat: Yup.string()
          .min(8)
          .oneOf([Yup.ref('password'), null])
          .required(),
      })}
      onSubmit={onSubmit}
    />
  )
}

PasswordResetForm.propTypes = propTypes

export default PasswordResetForm
