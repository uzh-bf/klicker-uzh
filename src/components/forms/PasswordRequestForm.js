import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { object, string } from 'yup'
import _isEmpty from 'lodash/isEmpty'
import { Formik } from 'formik'

import { FormWithLinks, FormikInput } from '.'

const propTypes = {
  intl: intlShape.isRequired,
  loading: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const PasswordRequestForm = ({ intl, loading, onSubmit }) => {
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
    <Formik
      initialValues={{
        email: '',
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
            disabled: !_isEmpty(errors),
            label: intl.formatMessage({
              defaultMessage: 'Submit',
              id: 'form.common.button.submit',
            }),
            loading: loading && isSubmitting,
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
        </FormWithLinks>
      )}
      validationSchema={object().shape({
        email: string()
          .email()
          .required(),
      })}
      onSubmit={onSubmit}
    />
  )
}

PasswordRequestForm.propTypes = propTypes

export default PasswordRequestForm
