import React from 'react'
import _isEmpty from 'lodash/isEmpty'
import getConfig from 'next/config'
import { FormattedMessage, useIntl } from 'react-intl'
import { Button, Checkbox, Form } from 'semantic-ui-react'
import { object, boolean } from 'yup'
import { useFormik } from 'formik'

import FormikInput from './components/FormikInput'
import validationSchema from './common/validationSchema'
import messages from './common/messages'

const { publicRuntimeConfig } = getConfig()

const { email, shortname, institution, password, passwordRepeat, useCase } = validationSchema

interface Props {
  loading: boolean
  onSubmit: any
}

function RegistrationForm({ loading, onSubmit }: Props): React.ReactElement {
  const intl = useIntl()

  const requiredValidationSchema = object()
    .shape({
      acceptTOS: boolean().oneOf([true]).required(),
      email: email.required(),
      institution: institution.required(),
      password: password.required(),
      passwordRepeat: passwordRepeat.required(),
      shortname: shortname.required(),
      useCase,
    })
    .required()

  const formik = useFormik({
    initialValues: {
      acceptTOS: false,
      email: '',
      institution: '',
      password: '',
      passwordRepeat: '',
      shortname: '',
      useCase: '',
    },
    onSubmit,
    validationSchema: requiredValidationSchema,
  })

  return (
    <div className="registrationForm">
      <Form error onSubmit={formik.handleSubmit}>
        <FormikInput
          autoFocus
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
        <div className="password">
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
        </div>
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
        <div className="submit">
          <Form.Field>
            <label>ToS &amp; Privacy Policy</label>
            <Checkbox
              checked={formik.values.acceptTOS}
              label={
                <label>
                  <FormattedMessage
                    defaultMessage="By registering, I accept the site {terms} and {privacy}."
                    id="user.registration.tos"
                    values={{
                      privacy: (
                        <a href="http://www.klicker.uzh.ch/privacy" rel="noopener noreferrer" target="_blank">
                          Privacy Policy
                        </a>
                      ),
                      terms: (
                        <a href="http://www.klicker.uzh.ch/tos" rel="noopener noreferrer" target="_blank">
                          Terms of Service
                        </a>
                      ),
                    }}
                  />
                </label>
              }
              name="acceptTOS"
              onChange={(): void => formik.setFieldValue('acceptTOS', !formik.values.acceptTOS)}
            />
          </Form.Field>
          <Button
            primary
            disabled={!_isEmpty(formik.errors) || _isEmpty(formik.touched)}
            floated="right"
            loading={loading && formik.isSubmitting}
            type="submit"
          >
            <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
          </Button>
        </div>
      </Form>

      <style jsx>{`
        @import 'src/theme';

        .registrationForm > :global(form) {
          display: flex;
          flex-direction: column;

          .password {
            margin-bottom: 1rem;
          }

          @include desktop-tablet-only {
            border: 1px solid $color-primary;
            padding: 1rem;
            background-color: rgba(124, 184, 228, 0.12);

            .password {
              display: flex;
              flex-direction: row;
              margin-bottom: 0;

              :global(.field) {
                flex: 1;

                &:first-child {
                  margin-right: 1rem;
                }
              }
            }
          }
        }
      `}</style>
    </div>
  )
}

export default RegistrationForm
