import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Form } from 'semantic-ui-react'

import { Formik } from 'formik'
import Yup from 'yup'
import _isEmpty from 'lodash/isEmpty'

import { FormikInput } from '.'

/* const validate = ({
  institution, email, shortname, password, passwordRepeat, useCase,
}) => {
  const errors = {}


  // the shortname is allowed to be within 3 to 6 chars
  if (!shortname || !isAlphanumeric(shortname) || !isLength(shortname, { max: 6, min: 3 })) {
    errors.shortname = 'form.shortname.invalid'
  }

  // both password fields need to match
  if (!passwordRepeat || passwordRepeat !== password) {
    errors.passwordRepeat = 'form.passwordRepeat.invalid'
  }

  if (useCase && !isAlphanumeric(useCase)) {
    errors.useCase = 'form.useCase.invalid'
  }

  return errors
} */

const propTypes = {
  intl: intlShape.isRequired,
  onSubmit: PropTypes.func.isRequired,
}

const RegistrationForm = ({ intl, onSubmit }) => (
  <div className="registrationForm">
    <Formik
      initialValues={{
        email: null,
        institution: null,
        password: null,
        passwordRepeat: null,
        shortname: null,
        useCase: null,
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
          <div className="personal">
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
                defaultMessage: 'Please provide a valid account ID (3-6 characters).',
                id: 'form.shortname.invalid',
              })}
              handleBlur={handleBlur}
              handleChange={handleChange}
              icon="hashtag"
              intl={intl}
              label={intl.formatMessage({
                defaultMessage: 'Account ID',
                id: 'form.shortname.label',
              })}
              name="shortname"
              placeholder="klicker.uzh.ch/join/ID..."
              tooltip={intl.formatMessage({
                defaultMessage:
                  'A unique identifier for your account. Must be between 3 and 6 characters long (alphanumeric).',
                id: 'tooltip',
              })}
              touched={touched.shortname}
              type="text"
              value={values.shortname}
            />
          </div>
          <div className="account">
            <FormikInput
              required
              error={errors.password}
              errorMessage={intl.formatMessage({
                defaultMessage: 'Please provide a valid password (8+ characters).',
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
          <div className="use">
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
                defaultMessage: 'Short description of your planned use case for the IBF Klicker.',
                id: 'tooltip',
              })}
              touched={touched.useCase}
              type="text"
              value={values.useCase}
            />
          </div>
          <Button
            primary
            disabled={!_isEmpty(errors) || _isEmpty(touched)}
            floated="right"
            loading={isSubmitting}
            type="submit"
          >
            <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
          </Button>
        </Form>
      )}
      validationSchema={Yup.object().shape({
        email: Yup.string()
          .email()
          .required(),
        insitution: Yup.string().required(),
        password: Yup.string()
          .min(8)
          .required(),
        passwordRepeat: Yup.string()
          .min(8)
          .oneOf([Yup.ref('password'), null])
          .required(),
        shortname: Yup.string()
          .min(3)
          .max(6)
          .required(),
        useCase: Yup.string(),
      })}
      onSubmit={onSubmit}
    />

    <style jsx>{`
      @import 'src/theme';

      .registrationForm > :global(form) {
        display: flex;
        flex-direction: column;
        .account {
          margin-top: 1rem;
        }
        .use {
          display: flex;
          flex-direction: column;

          margin-top: 1rem;
        }

        @include desktop-tablet-only {
          flex-flow: row wrap;
          border: 1px solid $color-primary;
          padding: 1rem;
          background-color: rgba(124, 184, 228, 0.12);

          .personal,
          .account {
            flex: 1 1 50%;
          }
          .personal {
            padding-right: 0.5rem;
          }
          .account {
            margin: 0;
          }
          .use {
            flex: 1;
          }
        }
      }
    `}</style>
  </div>
)

RegistrationForm.propTypes = propTypes

export default RegistrationForm
