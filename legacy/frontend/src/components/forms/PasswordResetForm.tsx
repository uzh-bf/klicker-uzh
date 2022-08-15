import { Formik } from 'formik'
import _isEmpty from 'lodash/isEmpty'
import React from 'react'
import { useIntl } from 'react-intl'
import { object } from 'yup'

import messages from './common/messages'
import validationSchema from './common/validationSchema'
import FormikInput from './components/FormikInput'
import FormWithLinks from './components/FormWithLinks'

const { password, passwordRepeat } = validationSchema

interface Props {
  loading: boolean
  onSubmit: any
}

function PasswordResetForm({ loading, onSubmit }: Props): React.ReactElement {
  const intl = useIntl()

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
      }): React.ReactElement => (
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

export default PasswordResetForm
