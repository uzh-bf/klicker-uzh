import React from 'react'
import { Mutation } from 'react-apollo'
import { intlShape, FormattedMessage } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import { Form, Button } from 'semantic-ui-react'

import { FormikInput } from '..'
import { ChangePasswordMutation } from '../../../graphql'
import validationSchema from '../common/validationSchema'
import messages from '../common/messages'

const { password, passwordRepeat } = validationSchema

const propTypes = {
  intl: intlShape.isRequired,
}

const PasswordUpdateForm = ({ intl }) => (
  <div className="passwordUpdateForm">
    <Mutation mutation={ChangePasswordMutation}>
      {changePassword => (
        <Formik
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
          }) => (
            <Form onSubmit={handleSubmit}>
              <FormikInput
                required
                error={errors.password}
                errorMessage={intl.formatMessage(messages.passwordInvalid)}
                handleBlur={handleBlur}
                handleChange={handleChange}
                icon="privacy"
                intl={intl}
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
                intl={intl}
                label={intl.formatMessage(messages.passwordRepeatLabel)}
                name="passwordRepeat"
                touched={touched.passwordRepeat}
                type="password"
                value={values.passwordRepeat}
              />
              <Button
                primary
                disabled={isSubmitting || !isValid || !dirty}
                floated="right"
                loading={isSubmitting}
                type="submit"
              >
                <FormattedMessage defaultMessage="Save Changes" id="form.button.saveChanges" />
              </Button>
            </Form>
          )}
          validationSchema={object()
            .shape({
              password,
              passwordRepeat,
            })
            .required()}
          onSubmit={async (values, { setSubmitting }) => {
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
      )}
    </Mutation>
  </div>
)

PasswordUpdateForm.propTypes = propTypes

export default PasswordUpdateForm
