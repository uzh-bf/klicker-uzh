import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { object } from 'yup'
import _isEmpty from 'lodash/isEmpty'
import { Formik } from 'formik'

import { FormWithLinks, FormikInput } from '.'
import validationSchema from './common/validationSchema'
import messages from './common/messages'

const { email } = validationSchema

const propTypes = {
  intl: intlShape.isRequired,
  loading: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const PasswordRequestForm = ({ intl, loading, onSubmit }) => {
  const links = [
    {
      href: '/user/login',
      label: intl.formatMessage(messages.backToLogin),
    },
  ]

  return (
    <Formik
      initialValues={{
        email: '',
      }}
      render={({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
        <FormWithLinks
          button={{
            disabled: !_isEmpty(errors),
            label: intl.formatMessage(messages.submit),
            loading: loading && isSubmitting,
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
        </FormWithLinks>
      )}
      validationSchema={object()
        .shape({
          email: email.required(),
        })
        .required()}
      onSubmit={onSubmit}
    />
  )
}

PasswordRequestForm.propTypes = propTypes

export default PasswordRequestForm
