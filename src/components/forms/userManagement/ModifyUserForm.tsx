import React from 'react'
import getConfig from 'next/config'
import { FormattedMessage, useIntl } from 'react-intl'
import { Formik } from 'formik'
import { object } from 'yup'
import { Form, Button, Confirm } from 'semantic-ui-react'

import FormikInput from '../components/FormikInput'
import validationSchema from '../common/validationSchema'
import messages from '../common/messages'

const { publicRuntimeConfig } = getConfig()

const { email, institution, shortname } = validationSchema

interface Props {
  id: string
  currentEmail: string
  currentShortname: string
  currentInsitution: string
  currentRole: string
  editConfirmation: boolean
  handleModification: (values, confirm) => Promise<any>
  onDiscard: () => void
}

function ModifyUserForm({
  id,
  currentEmail,
  currentShortname,
  currentInsitution,
  currentRole,
  editConfirmation,
  handleModification,
  onDiscard,
}: Props): React.ReactElement {
  const intl = useIntl()


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
              disabled={ !isValid || !dirty}
              floated="right"
              type="submit"
            >
              <FormattedMessage defaultMessage="Save Changes" id="form.button.saveChanges" />
            </Button>
            <Button 
                className="discard" 
                floated="right" 
                type="button"
                onClick={onDiscard} 
                >
                <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
            </Button>
            <Confirm 
                  className="userDeletion"
                  cancelButton={'Go Back'}
                  confirmButton={'Delete User'}
                  content={`Are you sure that you want to delete the user ${id}?`}
                  open={editConfirmation}
                  onCancel={(values) => {
                    handleModification(values, true)
                    }}
                  onConfirm={(values) => handleModification(values, true)}
                />
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
        onSubmit={(values, {setSubmitting, setFieldError}) => {
            try {
                handleModification(values, true)
            }catch(message){}
        }}
        
      />
    </div>
  )
}

export default ModifyUserForm
