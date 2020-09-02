import React from 'react'
import getConfig from 'next/config'
import { useMutation } from '@apollo/react-hooks'
import { FormattedMessage, useIntl } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import { Form, Button } from 'semantic-ui-react'

import ModifyUserAsAdminMutation from '../../../graphql/mutations/ModifyUserAsAdminMutation.graphql'
import FormikInput from '../components/FormikInput'
import validationSchema from '../common/validationSchema'
import messages from '../common/messages'
import { Errors } from '../../../constants'

const { publicRuntimeConfig } = getConfig()

const { email, institution, shortname } = validationSchema

interface Props {
  id: string
  currentEmail: string
  currentShortname: string
  currentInsitution: string
  currentRole: string
}

function ModifyUserForm({
  id,
  currentEmail,
  currentShortname,
  currentInsitution,
  currentRole,
}: Props): React.ReactElement {
  const intl = useIntl()

  const [modifyUser] = useMutation(ModifyUserAsAdminMutation)

  return (
    <div className="accountDataForm">
      <Formik
        enableReinitialize
        initialValues={{
          email: currentEmail,
          shortname: currentShortname,
          institution: currentInsitution,
          role: currentRole,
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
              error={errors.role}
              handleBlur={handleBlur}
              handleChange={handleChange}
              icon="info"
              label={intl.formatMessage(messages.useCaseLabel)}
              name="role"
              tooltip={intl.formatMessage(messages.useCaseTooltip)}
              touched={touched.role}
              type="text"
              value={values.role}
            />
            <h1>{id}</h1>

            <Button
              primary
              disabled={isSubmitting || !isValid || !dirty}
              floated="right"
              loading={isSubmitting}
              type="submit"
            >
              <FormattedMessage defaultMessage="Save Changes" id="form.button.saveChanges" />
            </Button>
            <style jsx>
              {`
                @import 'src/theme';

                .buttonContainer {
                  height: 39px;
                  margin: 0 0 0.2em 0.2em;
                  align-self: flex-end;
                }
                :global(.ui .form .field) {
                  width: 100%;
                  margin: 0 0 0.2em;
                }
              `}
            </style>
          </Form>
        )}
        validationSchema={object()
          .shape({
            email,
            institution,
            shortname,
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

export default ModifyUserForm
