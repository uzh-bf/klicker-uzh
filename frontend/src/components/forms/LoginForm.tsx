import React from 'react'
import { Formik } from 'formik'
import { object } from 'yup'
import _isEmpty from 'lodash/isEmpty'
import { useIntl } from 'react-intl'

import FormWithLinks from './components/FormWithLinks'
import FormikInput from './components/FormikInput'
import validationSchema from './common/validationSchema'
import messages from './common/messages'

const { email, password } = validationSchema

interface Props {
  loading: boolean
  onSubmit: any
}

function LoginForm({ loading, onSubmit }: Props): React.ReactElement {
  const intl = useIntl()

  const links = [
    {
      href: '/user/requestPassword',
      label: intl.formatMessage(messages.forgotPassword),
    },
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
            error={errors.email}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="mail"
            label={intl.formatMessage(messages.emailLabel)}
            name="email"
            touched={touched.email}
            type="email"
            value={values.email}
          />
          <FormikInput
            required
            error={errors.password}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="privacy"
            label={intl.formatMessage(messages.passwordLabel)}
            name="password"
            touched={touched.password}
            type="password"
            value={values.password}
          />
        </FormWithLinks>
      )}
      validationSchema={object()
        .shape({
          email: email.required(),
          password: password.required(),
        })
        .required()}
      onSubmit={onSubmit}
    />
  )
}

export default LoginForm
