import React from 'react'
import { useMutation } from '@apollo/react-hooks'
import { FormattedMessage, useIntl } from 'react-intl'
import { useFormik } from 'formik'
import { object } from 'yup'
import { Form, Button } from 'semantic-ui-react'

import FormikInput from '../components/FormikInput'
import ChangePasswordMutation from '../../../graphql/mutations/ChangePasswordMutation.graphql'
import validationSchema from '../common/validationSchema'
import messages from '../common/messages'

const { password, passwordRepeat } = validationSchema

function PasswordUpdateForm(): React.ReactElement {
  const intl = useIntl()

  const [changePassword] = useMutation(ChangePasswordMutation)

  const initialValues = {
    password: undefined,
    passwordRepeat: undefined,
  }

  const requiredValidationSchema = object()
    .shape({
      password,
      passwordRepeat,
    })
    .required()

  const onSubmit = async (values, { setSubmitting }): Promise<void> => {
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
  }

  const formik = useFormik({
    initialValues,
    validationSchema: requiredValidationSchema,
    onSubmit,
  })

  return (
    <div className="passwordUpdateForm">
      <Form onSubmit={formik.handleSubmit}>
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
        <Button
          primary
          disabled={formik.isSubmitting || !formik.isValid || !formik.dirty}
          floated="right"
          loading={formik.isSubmitting}
          type="submit"
        >
          <FormattedMessage defaultMessage="Save Changes" id="form.button.saveChanges" />
        </Button>
      </Form>
    </div>
  )
}

export default PasswordUpdateForm
