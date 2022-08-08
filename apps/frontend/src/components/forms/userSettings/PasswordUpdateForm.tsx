import React from 'react'
import { useMutation } from '@apollo/client'
import { FormattedMessage, useIntl } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import { Form } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'

import FormikInput from '../components/FormikInput'
import ChangePasswordMutation from '../../../graphql/mutations/ChangePasswordMutation.graphql'
import validationSchema from '../common/validationSchema'
import messages from '../common/messages'

const { password, passwordRepeat } = validationSchema

function PasswordUpdateForm(): React.ReactElement {
  const intl = useIntl()

  const [changePassword] = useMutation(ChangePasswordMutation)

  return (
    <div className="passwordUpdateForm">
      <Formik
        initialValues={{
          password: undefined,
          passwordRepeat: undefined,
        }}
        render={({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          handleSubmit,
          isSubmitting,
          isValid,
          dirty,
        }): React.ReactElement => (
          <Form onSubmit={handleSubmit}>
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
            <Button
              className="float-right h-10 px-4 font-bold text-white bg-uzh-blue-80 disabled:opacity-60"
              disabled={isSubmitting || !isValid || !dirty}
              loading={isSubmitting}
              type="submit"
            >
              <Button.Label>
                <FormattedMessage defaultMessage="Save Changes" id="form.button.saveChanges" />
              </Button.Label>
            </Button>
          </Form>
        )}
        validationSchema={object()
          .shape({
            password,
            passwordRepeat,
          })
          .required()}
        onSubmit={async (values, { setSubmitting }): Promise<void> => {
          try {
            await changePassword({
              variables: {
                newPassword: values.passwordRepeat,
              },
            })
          } catch ({ message }) {
            console.log(message)
          }

          setSubmitting(false)
        }}
      />
    </div>
  )
}

export default PasswordUpdateForm
