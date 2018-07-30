import React from 'react'
import { Query } from 'react-apollo'
import { intlShape } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import { Form, Button } from 'semantic-ui-react'

import { AccountSummaryQuery } from '../../../graphql'
import { FormikInput } from '..'
import validationSchema from '../common/validationSchema'
import messages from '../common/messages'

const { email, institution, useCase, shortname } = validationSchema

const propTypes = {
  intl: intlShape.isRequired,
}

const AccountDataForm = ({ intl }) => (
  <div className="accountDataForm">
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
          render={({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
            <Form loading={loading} onSubmit={handleSubmit}>
              <FormikInput
                error={errors.email}
                errorMessage={intl.formatMessage(messages.emailInvalid)}
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
                errorMessage={intl.formatMessage(messages.shortnameInvalid)}
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
              <Button primary disabled={isSubmitting} floated="right" loading={isSubmitting} type="submit">
                Save Changes
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
          onSubmit={values =>
            console.log({
              email: values.email || data.user.email,
              institution: values.institution || data.user.institution,
              shortname: values.shortname || data.user.shortname,
              useCase: values.useCase || data.user.useCase,
            })
          }
        />
      )}
    </Query>

    <style jsx>{`
      @import 'src/theme';
      .accountDataForm {
      }
    `}</style>
  </div>
)

AccountDataForm.propTypes = propTypes

export default AccountDataForm
