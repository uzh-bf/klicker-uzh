import React from 'react'
import PropTypes from 'prop-types'
import _isEmpty from 'lodash/isEmpty'
import { intlShape } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'

import { FormWithLinks, FormikInput } from '.'
import validationSchema from './common/validationSchema'
import messages from './common/messages'

const { password, passwordRepeat } = validationSchema

const propTypes = {
  intl: intlShape.isRequired,
  loading: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const PasswordResetForm = ({ intl, loading, onSubmit }) => {
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
      render={({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
        <FormWithLinks
          button={{
            disabled: !_isEmpty(errors) || _isEmpty(touched),
            label: intl.formatMessage(messages.submit),
            loading: loading && isSubmitting,
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
      validationSchema={object()
        .shape({
          password: password.required(),
          passwordRepeat: passwordRepeat.required(),
        })
        .required()}
      onSubmit={onSubmit}
    />
  )
}

PasswordResetForm.propTypes = propTypes

export default PasswordResetForm
