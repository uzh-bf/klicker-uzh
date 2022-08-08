import React from 'react'
import { Formik } from 'formik'
import { useIntl, FormattedMessage } from 'react-intl'
import { Form } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'
import { object, string } from 'yup'

import FormikInput from './components/FormikInput'
import messages from './common/messages'

interface Props {
  onSubmit: ({ username, password }) => void
}

const initialValues = { username: '', password: '' }

const validationSchema = object()
  .shape({
    username: string().min(1).required(),
    password: string().min(1).required(),
  })
  .required()

function ParticipantLoginForm({ onSubmit }: Props): React.ReactElement {
  const intl = useIntl()

  return (
    <Formik
      initialValues={initialValues}
      isInitialValid={false}
      validationSchema={validationSchema}
      onSubmit={onSubmit}
    >
      {({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
        isValid,
      }): React.ReactElement => (
        <Form error onSubmit={handleSubmit}>
          <FormikInput
            required
            error={errors.username}
            errorMessage={intl.formatMessage(messages.usernameInvalid)}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="user"
            label={intl.formatMessage(messages.usernameLabel)}
            name="username"
            touched={touched.username}
            type="text"
            value={values.username}
          />

          <FormikInput
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

          <Button disabled={!isValid || isSubmitting} type="submit">
            <Button.Label>
              <FormattedMessage defaultMessage="Login" id="common.button.login" />
            </Button.Label>
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default ParticipantLoginForm
