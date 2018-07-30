import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Form } from 'semantic-ui-react'
import { object } from 'yup'

import { Formik } from 'formik'
import _isEmpty from 'lodash/isEmpty'

import { FormikInput } from '.'
import validationSchema from './common/validationSchema'
import messages from './common/messages'

const { email, shortname, institution, password, passwordRepeat, useCase } = validationSchema

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
      render={({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
        <Form error onSubmit={handleSubmit}>
          <FormikInput
            autoFocus
            required
            error={errors.email}
            errorMessage={intl.formatMessage(messages.emailInvalid)}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="mail"
            intl={intl}
            label={intl.formatMessage(messages.emailLabel)}
            name="email"
            touched={touched.email}
            type="email"
            value={values.email}
          />
          <FormikInput
            required
            error={errors.shortname}
            errorMessage={intl.formatMessage(messages.shortnameInvalid)}
            handleBlur={handleBlur}
            handleChange={handleChange}
            icon="hashtag"
            inlineLabel="beta.klicker.uzh.ch/join/"
            intl={intl}
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
              intl={intl}
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
              intl={intl}
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
            icon="university"
            intl={intl}
            label={intl.formatMessage(messages.useCaseLabel)}
            name="useCase"
            tooltip={intl.formatMessage(messages.useCaseTooltip)}
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
              <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
            </Button>
          </div>
        </Form>
      )}
      validationSchema={object()
        .shape({
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
