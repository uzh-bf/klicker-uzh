import React from 'react'
import { useFormik } from 'formik'
import { useIntl, FormattedMessage } from 'react-intl'
import { Form, Button } from 'semantic-ui-react'
import { object, string } from 'yup'

import FormikInput from './components/FormikInput'
import messages from './common/messages'

interface Props {
  onSubmit: ({ username, password }) => void
}

const initialValues = { username: '', password: '' }

function ParticipantLoginForm({ onSubmit }: Props): React.ReactElement {
  const intl = useIntl()

  const requiredValidationSchema = object()
    .shape({
      username: string().min(1).required(),
      password: string().min(1).required(),
    })
    .required()

  const formik = useFormik({
    initialValues,
    isInitialValid: false,
    validationSchema: requiredValidationSchema,
    onSubmit,
  })

  return (
    <Form error onSubmit={formik.handleSubmit}>
      <FormikInput
        required
        error={formik.errors.username}
        errorMessage={intl.formatMessage(messages.usernameInvalid)}
        handleBlur={formik.handleBlur}
        handleChange={formik.handleChange}
        icon="user"
        label={intl.formatMessage(messages.usernameLabel)}
        name="username"
        touched={formik.touched.username}
        type="text"
        value={formik.values.username}
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

      <Button primary disabled={!formik.isValid || formik.isSubmitting} type="submit">
        <FormattedMessage defaultMessage="Login" id="common.button.login" />
      </Button>
    </Form>
  )
}

export default ParticipantLoginForm
