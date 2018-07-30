import React from 'react'
import PropTypes from 'prop-types'
import { defineMessages, intlShape } from 'react-intl'
import { Formik } from 'formik'
import { object, string } from 'yup'
import { Form } from 'semantic-ui-react'

import { FormikInput } from '..'

const messages = defineMessages({
  emailInvalid: {
    defaultMessage: 'Please provide a valid email address.',
    id: 'form.email.invalid'
  }
})

const propTypes = {
  intl: intlShape.isRequired
}

const AccountDataForm = ({ intl }) => (
  <div className="accountDataForm">
    <Formik
      initialValues={{
        email: '',
        institution: '',
        password: '',
        passwordRepeat: '',
        shortname: '',
        useCase: ''
      }}
      render={({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting
      }) => (
        <Form>
          <FormikInput
            required
            error={errors.password}
            errorMessage={intl.formatMessage(messages.emailInvalid)}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="privacy"
            intl={intl}
            label={intl.formatMessage(messages.emailInvalid)}
            name="password"
            touched={touched.password}
            type="password"
            value={values.password}
          />
        </Form>
      )}
    />

    <style jsx>{`
      @import 'src/theme';
      .accountDataForm {
      }
    `}</style>
  </div>
)

AccountDataForm.propTypes = propTypes

export default AccountDataForm
