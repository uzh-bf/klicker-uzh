import React from 'react'
import PropTypes from 'prop-types'
import _isEmpty from 'lodash/isEmpty'
import { intlShape } from 'react-intl'
import { Formik } from 'formik'
import { object, string, ref } from 'yup'

import { FormWithLinks, FormikInput } from '.'

const propTypes = {
  intl: intlShape.isRequired,
  loading: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const PasswordResetForm = ({ intl, loading, onSubmit }) => {
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
            error={errors.password}
            errorMessage={intl.formatMessage({
              defaultMessage:
                'Please provide a valid password (8+ characters).',
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
          <FormikInput
            required
            error={errors.passwordRepeat}
            errorMessage={intl.formatMessage({
              defaultMessage: 'Please ensure that passwords match.',
              id: 'form.passwordRepeat.invalid',
            })}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="privacy"
            intl={intl}
            label={intl.formatMessage({
              defaultMessage: 'Repeat password',
              id: 'form.passwordRepeat.label',
            })}
            name="passwordRepeat"
            touched={touched.passwordRepeat}
            type="password"
            value={values.passwordRepeat}
          />
        </FormWithLinks>
      )}
      validationSchema={object().shape({
        password: string()
          .min(8)
          .required(),
        passwordRepeat: string()
          .min(8)
          .oneOf([ref('password'), null])
          .required(),
      })}
      onSubmit={onSubmit}
    />
  )
}

PasswordResetForm.propTypes = propTypes

export default PasswordResetForm
