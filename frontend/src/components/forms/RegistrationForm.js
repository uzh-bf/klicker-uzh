import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Form } from 'semantic-ui-react'

import { Formik } from 'formik'
import { object, string, ref } from 'yup'
import _isEmpty from 'lodash/isEmpty'

import { FormikInput } from '.'

const propTypes = {
  intl: intlShape.isRequired,
  loading: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const RegistrationForm = ({ intl, loading, onSubmit }) => (
  <div className="registrationForm">
    <Formik
      initialValues={{
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
      }) => (
        <Form error onSubmit={handleSubmit}>
          <FormikInput
            autoFocus
            required
            error={errors.email}
            errorMessage={intl.formatMessage({
              defaultMessage: 'Please provide a valid email address.',
              id: 'form.email.invalid',
            })}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="mail"
            intl={intl}
            label={intl.formatMessage({
              defaultMessage: 'Email',
              id: 'form.email.label',
            })}
            name="email"
            touched={touched.email}
            type="email"
            value={values.email}
          />
          <FormikInput
            required
            error={errors.shortname}
            errorMessage={intl.formatMessage({
              defaultMessage:
                'Please provide a valid account ID (3-8 characters).',
              id: 'form.shortname.invalid',
            })}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="hashtag"
            inlineLabel="beta.klicker.uzh.ch/join/"
            intl={intl}
            label={intl.formatMessage({
              defaultMessage: 'Account ID / Join Link',
              id: 'form.shortname.label',
            })}
            name="shortname"
            placeholder="xyz123"
            tooltip={intl.formatMessage({
              defaultMessage:
                'A unique identifier for your account. Must be between 3 and 8 characters long (only alphanumeric and hyphen).',
              id: 'tooltip',
            })}
            touched={touched.shortname}
            type="text"
            value={values.shortname}
          />
          <div className="password">
            <FormikInput
              required
              error={errors.password}
              errorMessage={intl.formatMessage({
                defaultMessage:
                  'Please provide a valid password (8+ characters).',
                id: 'form.password.invalid',
              })}
              handleBlur={handleBlur}
              handleChange={handleChange}
              icon="privacy"
              intl={intl}
              label={intl.formatMessage({
                defaultMessage: 'Password',
                id: 'form.password.label',
              })}
              name="password"
              touched={touched.password}
              type="password"
              value={values.password}
            />
            <FormikInput
              required
              error={errors.passwordRepeat}
              errorMessage={intl.formatMessage({
                defaultMessage: 'Please ensure that passwords match.',
                id: 'form.passwordRepeat.invalid',
              })}
              handleBlur={handleBlur}
              handleChange={handleChange}
              icon="privacy"
              intl={intl}
              label={intl.formatMessage({
                defaultMessage: 'Repeat password',
                id: 'form.passwordRepeat.label',
              })}
              name="passwordRepeat"
              touched={touched.passwordRepeat}
              type="password"
              value={values.passwordRepeat}
            />
          </div>
          <FormikInput
            required
            error={errors.institution}
            errorMessage={intl.formatMessage({
              defaultMessage: 'Please provide a valid institution.',
              id: 'form.institution.invalid',
            })}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="university"
            intl={intl}
            label={intl.formatMessage({
              defaultMessage: 'Institution',
              id: 'form.institution.label',
            })}
            name="institution"
            touched={touched.institution}
            type="text"
            value={values.institution}
          />
          <FormikInput
            error={errors.useCase}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="university"
            intl={intl}
            label={intl.formatMessage({
              defaultMessage: 'Use case description',
              id: 'form.useCase.label',
            })}
            name="useCase"
            tooltip={intl.formatMessage({
              defaultMessage:
                'Short description of your planned use case for the Klicker UZH.',
              id: 'tooltip',
            })}
            touched={touched.useCase}
            type="text"
            value={values.useCase}
          />
          <div className="submit">
            <Button
              primary
              disabled={!_isEmpty(errors) || _isEmpty(touched)}
              floated="right"
              loading={loading && isSubmitting}
              type="submit"
            >
              <FormattedMessage
                defaultMessage="Submit"
                id="common.button.submit"
              />
            </Button>
          </div>
        </Form>
      )}
      validationSchema={object().shape({
        email: string()
          .email()
          .required(),
        institution: string().required(),
        password: string()
          .min(8)
          .required(),
        passwordRepeat: string()
          .min(8)
          .oneOf([ref('password'), null])
          .required(),
        shortname: string()
          .min(3)
          .max(8)
          .matches(/^[A-Za-z0-9-]+$/)
          .lowercase()
          .required(),
        useCase: string(),
      })}
      onSubmit={onSubmit}
    />

    <style jsx>
      {`
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
      `}
    </style>
  </div>
)

RegistrationForm.propTypes = propTypes

export default RegistrationForm
