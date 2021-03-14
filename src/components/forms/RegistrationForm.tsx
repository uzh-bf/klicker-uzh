import { Formik } from 'formik'
import _isEmpty from 'lodash/isEmpty'
import getConfig from 'next/config'
import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Button, Checkbox, Form } from 'semantic-ui-react'
import { boolean, object } from 'yup'
import messages from './common/messages'
import validationSchema from './common/validationSchema'
import FormikInput from './components/FormikInput'

const { publicRuntimeConfig } = getConfig()

const { email, shortname, institution, password, passwordRepeat, useCase } = validationSchema

interface Props {
  loading: boolean
  onSubmit: any
}

function RegistrationForm({ loading, onSubmit }: Props): React.ReactElement {
  const intl = useIntl()

  return (
    <div className="registrationForm">
      <Formik
        initialValues={{
          acceptTOS: false,
          email: '',
          institution: '',
          password: '',
          passwordRepeat: '',
          shortname: '',
          useCase: '',
        }}
        render={({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          handleSubmit,
          isSubmitting,
          setFieldValue,
        }): React.ReactElement => (
          <Form error onSubmit={handleSubmit}>
            <FormikInput
              autoFocus
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
            <div className="password">
              <FormikInput
                required
                error={errors.password}
                errorMessage={intl.formatMessage(messages.passwordInvalid)}
                handleBlur={handleBlur}
                handleChange={handleChange}
                icon="privacy"
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
                label={intl.formatMessage(messages.passwordRepeatLabel)}
                name="passwordRepeat"
                touched={touched.passwordRepeat}
                type="password"
                value={values.passwordRepeat}
              />
            </div>
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
            <div className="submit">
              <Form.Field>
                <label>ToS &amp; Privacy Policy</label>
                <Checkbox
                  checked={values.acceptTOS}
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
                  onChange={(): void => setFieldValue('acceptTOS', !values.acceptTOS)}
                />
              </Form.Field>
              <Button
                primary
                disabled={!_isEmpty(errors) || _isEmpty(touched)}
                floated="right"
                loading={loading && isSubmitting}
                type="submit"
              >
                <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
              </Button>
            </div>
          </Form>
        )}
        validationSchema={object()
          .shape({
            acceptTOS: boolean().oneOf([true]).required(),
            email: email.required(),
            institution: institution.required(),
            password: password.required(),
            passwordRepeat: passwordRepeat.required(),
            shortname: shortname.required(),
            useCase,
          })
          .required()}
        onSubmit={onSubmit}
      />

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
