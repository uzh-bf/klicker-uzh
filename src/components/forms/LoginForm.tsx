import React from 'react'
import { useFormik } from 'formik'
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

  const requiredValidationSchema = object()
    .shape({
      email: email.required(),
      password: password.required(),
    })
    .required()

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    onSubmit,
    validationSchema: requiredValidationSchema,
  })

  return (
    <FormWithLinks
      button={{
        disabled: !_isEmpty(formik.errors) || _isEmpty(formik.touched),
        label: intl.formatMessage(messages.submit),
        loading: loading && formik.isSubmitting,
        onSubmit: formik.handleSubmit,
      }}
      links={links}
    >
      <FormikInput
        autoFocus
        required
        error={formik.errors.email}
        errorMessage={intl.formatMessage(messages.emailInvalid)}
        handleBlur={formik.handleBlur}
        handleChange={formik.handleChange}
        icon="mail"
        label={intl.formatMessage(messages.emailLabel)}
        name="email"
        touched={formik.touched.email}
        type="email"
        value={formik.values.email}
      />
      <FormikInput
        required
        error={formik.errors.password}
        errorMessage={intl.formatMessage(messages.passwordInvalid)}
        handleBlur={formik.handleBlur}
        handleChange={formik.handleChange}
        icon="privacy"
        label={intl.formatMessage(messages.passwordLabel)}
        name="password"
        touched={formik.touched.password}
        type="password"
        value={formik.values.password}
      />
    </FormWithLinks>
  )
}

export default LoginForm
