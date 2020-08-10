import React from 'react'
import getConfig from 'next/config'
import _get from 'lodash/get'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { FormattedMessage, useIntl } from 'react-intl'
import { useFormik } from 'formik'
import { object } from 'yup'
import { Form, Button } from 'semantic-ui-react'

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

  const initialValues = {
    email: _get(data, 'user.email'),
    institution: _get(data, 'user.institution'),
    shortname: _get(data, 'user.shortname'),
    useCase: _get(data, 'user.useCase'),
  }

  const requiredValidationSchema = object()
    .shape({
      email,
      institution,
      shortname,
      useCase,
    })
    .required()

  const onSubmit = async (values, { setSubmitting, setFieldError }): Promise<void> => {
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
  }

  const formik = useFormik({
    initialValues,
    onSubmit,
    validationSchema: requiredValidationSchema,
    enableReinitialize: true,
  })

  return (
    <div className="accountDataForm">
      <Form loading={loading} onSubmit={formik.handleSubmit}>
        <FormikInput
          disabled
          required
          error={formik.errors.email}
          errorMessage={intl.formatMessage(
            formik.errors.email === 'NOT_AVAILABLE' ? messages.emailNotAvailable : messages.emailInvalid
          )}
          handleBlur={formik.handleBlur}
          handleChange={formik.handleChange}
          icon="mail"
          label={intl.formatMessage(messages.emailLabel)}
          name="email"
          touched={formik.touched.email}
          type="email"
          value={formik.values.email}
        />
        <FormikInput
          required
          error={formik.errors.shortname}
          errorMessage={intl.formatMessage(
            formik.errors.shortname === 'NOT_AVAILABLE' ? messages.shortnameNotAvailable : messages.shortnameInvalid
          )}
          handleBlur={formik.handleBlur}
          handleChange={formik.handleChange}
          icon="hashtag"
          inlineLabel={`${publicRuntimeConfig.baseUrl}/join/`}
          label={intl.formatMessage(messages.shortnameLabel)}
          name="shortname"
          placeholder="xyz123"
          tooltip={intl.formatMessage(messages.shortnameTooltip)}
          touched={formik.touched.shortname}
          type="text"
          value={formik.values.shortname}
        />
        <FormikInput
          required
          error={formik.errors.institution}
          errorMessage={intl.formatMessage(messages.institutionInvalid)}
          handleBlur={formik.handleBlur}
          handleChange={formik.handleChange}
          icon="university"
          label={intl.formatMessage(messages.institutionLabel)}
          name="institution"
          touched={formik.touched.institution}
          type="text"
          value={formik.values.institution}
        />
        <FormikInput
          error={formik.errors.useCase}
          handleBlur={formik.handleBlur}
          handleChange={formik.handleChange}
          icon="info"
          label={intl.formatMessage(messages.useCaseLabel)}
          name="useCase"
          tooltip={intl.formatMessage(messages.useCaseTooltip)}
          touched={formik.touched.useCase}
          type="text"
          value={formik.values.useCase}
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

export default AccountDataForm
