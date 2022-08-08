import { Formik } from 'formik'
import _isEmpty from 'lodash/isEmpty'
import React from 'react'
import { useIntl } from 'react-intl'
import { object } from 'yup'

import messages from './common/messages'
import validationSchema from './common/validationSchema'
import FormikInput from './components/FormikInput'
import FormWithLinks from './components/FormWithLinks'

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
      }): React.ReactElement => (
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
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="mail"
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

export default PasswordRequestForm
