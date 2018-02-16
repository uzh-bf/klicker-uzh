import React from 'react'
import PropTypes from 'prop-types'
import isAlpha from 'validator/lib/isAlpha'
import isAlphanumeric from 'validator/lib/isAlphanumeric'
import isEmail from 'validator/lib/isEmail'
import isLength from 'validator/lib/isLength'
import isEmpty from 'validator/lib/isEmpty'
import { FormattedMessage, intlShape } from 'react-intl'
import { Field, reduxForm } from 'redux-form'
import { Button, Form } from 'semantic-ui-react'

import { SemanticInput } from '.'

const validate = ({
  institution, email, shortname, password, passwordRepeat, useCase,
}) => {
  const errors = {}

  if (!institution || isEmpty(institution)) {
    errors.institution = 'form.institution.invalid'
  }

  // the email address needs to be valid
  if (!email || !isEmail(email)) {
    errors.email = 'form.email.invalid'
  }

  // the shortname is allowed to be within 3 to 6 chars
  if (!shortname || !isAlphanumeric(shortname) || !isLength(shortname, { max: 6, min: 3 })) {
    errors.shortname = 'form.shortname.invalid'
  }

  // password should at least have 7 characters (or more?)
  if (!password || !isLength(password, { max: undefined, min: 7 })) {
    errors.password = 'form.password.invalid'
  }

  // both password fields need to match
  if (!passwordRepeat || passwordRepeat !== password) {
    errors.passwordRepeat = 'form.passwordRepeat.invalid'
  }

  if (useCase && !isAlpha(useCase)) {
    errors.useCase = 'form.useCase.invalid'
  }

  return errors
}

const propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  invalid: PropTypes.bool.isRequired,
}

const RegistrationForm = ({ intl, invalid, handleSubmit: onSubmit }) => (
  <div className="registrationForm">
    <Form error onSubmit={onSubmit}>
      <div className="personal">
        <Field
          required
          component={SemanticInput}
          errorMessage={intl.formatMessage({
            defaultMessage: 'Please provide a valid email address.',
            id: 'form.email.invalid',
          })}
          icon="mail"
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'Email',
            id: 'form.email.label',
          })}
          name="email"
          type="email"
        />
        <Field
          required
          component={SemanticInput}
          errorMessage={intl.formatMessage({
            defaultMessage: 'Please provide a valid account ID (3-6 characters).',
            id: 'form.shortname.invalid',
          })}
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
          type="text"
        />
      </div>
      <div className="account">
        <Field
          required
          component={SemanticInput}
          errorMessage={intl.formatMessage({
            defaultMessage: 'Please provide a valid password (8+ characters).',
            id: 'form.password.invalid',
          })}
          icon="privacy"
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'Password',
            id: 'form.password.label',
          })}
          name="password"
          type="password"
        />
        <Field
          required
          component={SemanticInput}
          errorMessage={intl.formatMessage({
            defaultMessage: 'Please ensure that passwords match.',
            id: 'form.passwordRepeat.invalid',
          })}
          icon="privacy"
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'Repeat password',
            id: 'form.passwordRepeat.label',
          })}
          name="passwordRepeat"
          type="password"
        />
      </div>
      <div className="use">
        <Field
          required
          component={SemanticInput}
          errorMessage={intl.formatMessage({
            defaultMessage: 'Please provide a valid institution.',
            id: 'form.institution.invalid',
          })}
          icon="university"
          label={intl.formatMessage({
            defaultMessage: 'Institution',
            id: 'form.institution.label',
          })}
          name="institution"
          type="text"
        />
        <Field
          component={SemanticInput}
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
          type="text"
        />

        <Button primary disabled={invalid} floated="right" type="submit">
          <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
        </Button>
      </div>
    </Form>

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

export default reduxForm({
  form: 'registration',
  validate,
})(RegistrationForm)
