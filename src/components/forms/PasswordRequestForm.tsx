import React from 'react'
import { object } from 'yup'
import _isEmpty from 'lodash/isEmpty'
import { useFormik } from 'formik'
import { useIntl } from 'react-intl'

import FormWithLinks from './components/FormWithLinks'
import FormikInput from './components/FormikInput'
import validationSchema from './common/validationSchema'
import messages from './common/messages'

const { email } = validationSchema

interface Props {
  loading: boolean
  onSubmit: any
}

function PasswordRequestForm({ loading, onSubmit }: Props): React.ReactElement {
  const intl = useIntl()

  const links = [
    {
      href: '/user/login',
      label: intl.formatMessage(messages.backToLogin),
    },
  ]

  const requiredValidationSchema = object()
    .shape({
      email: email.required(),
    })
    .required()

  const formik = useFormik({
    initialValues: {
      email: '',
    },
    onSubmit,
    validationSchema: requiredValidationSchema,
  })

  return (
    <FormWithLinks
      button={{
        disabled: !_isEmpty(formik.errors),
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
    </FormWithLinks>
  )
}

export default PasswordRequestForm
