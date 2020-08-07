import React from 'react'
import _isEmpty from 'lodash/isEmpty'
import { useFormik } from 'formik'
import { object } from 'yup'
import { useIntl } from 'react-intl'

import FormWithLinks from './components/FormWithLinks'
import FormikInput from './components/FormikInput'
import validationSchema from './common/validationSchema'
import messages from './common/messages'

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

  const requiredValidationSchema = object()
    .shape({
      password: password.required(),
      passwordRepeat: passwordRepeat.required(),
    })
    .required()

  const formik = useFormik({
    initialValues: {
      password: '',
      passwordRepeat: '',
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

      <FormikInput
        required
        error={formik.errors.passwordRepeat}
        errorMessage={intl.formatMessage(messages.passwordRepeatInvalid)}
        handleBlur={formik.handleBlur}
        handleChange={formik.handleChange}
        icon="privacy"
        label={intl.formatMessage(messages.passwordRepeatLabel)}
        name="passwordRepeat"
        touched={formik.touched.passwordRepeat}
        type="password"
        value={formik.values.passwordRepeat}
      />
    </FormWithLinks>
  )
}

export default PasswordResetForm
