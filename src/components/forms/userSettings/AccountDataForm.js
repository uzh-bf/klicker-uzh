import React from 'react'
import { Query, Mutation } from 'react-apollo'
import { intlShape, FormattedMessage } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import { Form, Button } from 'semantic-ui-react'

import { AccountSummaryQuery, ModifyUserMutation } from '../../../graphql'
import { FormikInput } from '..'
import validationSchema from '../common/validationSchema'
import messages from '../common/messages'
import { Errors } from '../../../constants'

const { email, institution, useCase, shortname } = validationSchema

const propTypes = {
  intl: intlShape.isRequired,
}

const AccountDataForm = ({ intl }) => (
  <div className="accountDataForm">
    <Mutation mutation={ModifyUserMutation}>
      {modifyUser => (
        <Query query={AccountSummaryQuery}>
          {({ data, loading }) => (
            <Formik
              enableReinitialize
              initialValues={{
                email: data.user?.email,
                institution: data.user?.institution,
                shortname: data.user?.shortname,
                useCase: data.user?.useCase,
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
              }) => (
                <Form loading={loading} onSubmit={handleSubmit}>
                  <FormikInput
                    error={errors.email}
                    errorMessage={intl.formatMessage(
                      errors.email === 'NOT_AVAILABLE' ? messages.emailNotAvailable : messages.emailInvalid
                    )}
                    handleBlur={handleBlur}
                    handleChange={handleChange}
                    icon="email"
                    intl={intl}
                    label={intl.formatMessage(messages.emailLabel)}
                    name="email"
                    touched={touched.email}
                    type="email"
                    value={values.email}
                  />
                  <FormikInput
                    error={errors.shortname}
                    errorMessage={intl.formatMessage(
                      errors.shortname === 'NOT_AVAILABLE' ? messages.shortnameNotAvailable : messages.shortnameInvalid
                    )}
                    handleBlur={handleBlur}
                    handleChange={handleChange}
                    icon="email"
                    intl={intl}
                    label={intl.formatMessage(messages.shortnameLabel)}
                    name="shortname"
                    touched={touched.shortname}
                    type="text"
                    value={values.shortname}
                  />
                  <FormikInput
                    error={errors.institution}
                    errorMessage={intl.formatMessage(messages.institutionInvalid)}
                    handleBlur={handleBlur}
                    handleChange={handleChange}
                    icon="email"
                    intl={intl}
                    label={intl.formatMessage(messages.institutionLabel)}
                    name="institution"
                    touched={touched.institution}
                    type="text"
                    value={values.institution}
                  />
                  <FormikInput
                    error={errors.useCase}
                    handleBlur={handleBlur}
                    handleChange={handleChange}
                    icon="email"
                    intl={intl}
                    label={intl.formatMessage(messages.useCaseLabel)}
                    name="useCase"
                    touched={touched.useCase}
                    type="text"
                    value={values.useCase}
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
                  email,
                  institution,
                  shortname,
                  useCase,
                })
                .required()}
              onSubmit={async (values, { setSubmitting, setFieldError }) => {
                try {
                  await modifyUser({
                    variables: values,
                  })
                } catch ({ message }) {
                  if (message === Errors.SHORTNAME_NOT_AVAILABLE) {
                    setFieldError('shortname', 'NOT_AVAILABLE')
                  }
                  if (message === Errors.EMAIL_NOT_AVAILABLE) {
                    setFieldError('email', 'NOT_AVAILABLE')
                  }
                }

                setSubmitting(false)
              }}
            />
          )}
        </Query>
      )}
    </Mutation>

    <style jsx>{`
      @import 'src/theme';
      .accountDataForm {
      }
    `}</style>
  </div>
)

AccountDataForm.propTypes = propTypes

export default AccountDataForm
