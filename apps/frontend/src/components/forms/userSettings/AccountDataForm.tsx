import React from 'react'
import getConfig from 'next/config'
import _get from 'lodash/get'
import { useQuery, useMutation } from '@apollo/client'
import { FormattedMessage, useIntl } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import { Form } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'

import ModifyUserMutation from '../../../graphql/mutations/ModifyUserMutation.graphql'
import AccountSummaryQuery from '../../../graphql/queries/AccountSummaryQuery.graphql'
import FormikInput from '../components/FormikInput'
import validationSchema from '../common/validationSchema'
import messages from '../common/messages'
import { Errors } from '../../../constants'

const { publicRuntimeConfig } = getConfig()

const { email, institution, useCase, shortname } = validationSchema

function AccountDataForm(): React.ReactElement {
  const intl = useIntl()

  const [modifyUser] = useMutation(ModifyUserMutation)
  const { data, loading } = useQuery(AccountSummaryQuery)

  return (
    <div className="accountDataForm">
      <Formik
        enableReinitialize
        initialValues={{
          email: _get(data, 'user.email'),
          institution: _get(data, 'user.institution'),
          shortname: _get(data, 'user.shortname'),
          useCase: _get(data, 'user.useCase'),
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
          <Form loading={loading} onSubmit={handleSubmit}>
            <FormikInput
              disabled
              required
              error={errors.email}
              errorMessage={intl.formatMessage(
                errors.email === 'NOT_AVAILABLE' ? messages.emailNotAvailable : messages.emailInvalid
              )}
              handleBlur={handleBlur}
              handleChange={handleChange}
              icon="mail"
              label={intl.formatMessage(messages.emailLabel)}
              name="email"
              touched={touched.email}
              type="email"
              value={values.email}
            />
            <FormikInput
              required
              error={errors.shortname}
              errorMessage={intl.formatMessage(
                errors.shortname === 'NOT_AVAILABLE' ? messages.shortnameNotAvailable : messages.shortnameInvalid
              )}
              handleBlur={handleBlur}
              handleChange={handleChange}
              icon="hashtag"
              inlineLabel={`${publicRuntimeConfig.baseUrl}/join/`}
              label={intl.formatMessage(messages.shortnameLabel)}
              name="shortname"
              placeholder="xyz123"
              tooltip={intl.formatMessage(messages.shortnameTooltip)}
              touched={touched.shortname}
              type="text"
              value={values.shortname}
            />
            <FormikInput
              required
              error={errors.institution}
              errorMessage={intl.formatMessage(messages.institutionInvalid)}
              handleBlur={handleBlur}
              handleChange={handleChange}
              icon="university"
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
              icon="info"
              label={intl.formatMessage(messages.useCaseLabel)}
              name="useCase"
              tooltip={intl.formatMessage(messages.useCaseTooltip)}
              touched={touched.useCase}
              type="text"
              value={values.useCase}
            />
            <Button
              className="float-right h-10 px-4 font-bold text-white bg-uzh-blue-80 disabled:opacity-60"
              disabled={isSubmitting || !isValid || !dirty}
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
        onSubmit={async (values, { setSubmitting, setFieldError }): Promise<void> => {
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
    </div>
  )
}

export default AccountDataForm
