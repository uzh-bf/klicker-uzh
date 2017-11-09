import React from 'react'
import PropTypes from 'prop-types'
import isAlpha from 'validator/lib/isAlpha'
import isEmail from 'validator/lib/isEmail'
import isLength from 'validator/lib/isLength'
import isEmpty from 'validator/lib/isEmpty'
import { FormattedMessage, intlShape } from 'react-intl'
import { Field, reduxForm } from 'redux-form'
import { Button, Form } from 'semantic-ui-react'

import { SemanticInput } from '.'

const validate = ({
  firstName, lastName, email, shortname, password, passwordRepeat, useCase,
}) => {
  const errors = {}

  if (!firstName || !isAlpha(firstName) || isEmpty(firstName)) {
    errors.firstName = 'form.firstName.invalid'
  }

  if (!lastName || !isAlpha(lastName) || isEmpty(lastName)) {
    errors.lastName = 'form.lastName.invalid'
  }

  // the email address needs to be valid
  if (!email || !isEmail(email)) {
    errors.email = 'form.email.invalid'
  }

  // the shortname is allowed to be within 3 to 6 chars
  if (!shortname || !isAlpha(shortname) || !isLength(shortname, { max: 6, min: 3 })) {
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
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'First name',
            id: 'form.firstName.label',
          })}
          name="firstName"
          type="text"
        />
        <Field
          required
          component={SemanticInput}
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'Last name',
            id: 'form.lastName.label',
          })}
          name="lastName"
          type="text"
        />
        <Field
          required
          component={SemanticInput}
          icon="mail"
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'Email',
            id: 'form.email.label',
          })}
          name="email"
          type="email"
        />
      </div>

      <div className="account">
        <Field
          required
          component={SemanticInput}
          icon="hashtag"
          intl={intl}
          label={intl.formatMessage({
            defaultMessage: 'Account ID',
            id: 'form.shortname.label',
          })}
          tooltip={intl.formatMessage({
            defaultMessage:
              'A unique identifier for your account. Must be between 3 and 6 characters long.',
            id: 'tooltip',
          })}
          name="shortname"
          type="text"
        />
        <Field
          required
          component={SemanticInput}
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
        <div className="field">
          <label htmlFor="useCase">
            <FormattedMessage defaultMessage="Use case description" id="form.useCase.label" />
          </label>
          <Field name="useCase" component="textarea" type="text" />
        </div>

        <Button primary disabled={invalid} floated="right" type="submit">
          <FormattedMessage defaultMessage="Submit" id="form.button.submit" />
        </Button>
      </div>
    </Form>

    <style jsx>{`
      @import 'src/_theme';

      .registrationForm > :global(form) {
        display: flex;
        flex-direction: column;

        .account {
          margin-top: 1rem;
        }
        .use {
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
            padding-left: 0.5rem;
          }
          .use {
            flex: 1 1 100%;
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
