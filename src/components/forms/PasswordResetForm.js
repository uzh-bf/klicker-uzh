import React from 'react'
import PropTypes from 'prop-types'
import _isEmpty from 'lodash/isEmpty'
import { intlShape } from 'react-intl'
import { Formik } from 'formik'
import Yup from 'yup'

import { FormWithLinks, FormikInput } from '.'

const propTypes = {
  intl: intlShape.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const PasswordResetForm = ({ intl, onSubmit }) => {
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
        password: null,
        passwordRepeat: null,
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
