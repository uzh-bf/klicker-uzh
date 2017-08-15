// @flow

import React from 'react'
import isEmail from 'validator/lib/isEmail'
import isLength from 'validator/lib/isLength'
import { FormattedMessage } from 'react-intl'
import { Field, reduxForm } from 'redux-form'
import { Button } from 'semantic-ui-react'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../lib'
import { SemanticInput } from './components'

type Props = {
  intl: $IntlShape,
  handleSubmit: (values: {
    firstName: string,
    lastName: string,
    email: string,
    shortname: string,
    password: string,
    passwordRepeat: string,
    useCase: string,
  }) => mixed,
}

const validate = ({ email = '', shortname = '', password = '', passwordRepeat = '' }) => {
  const errors = {}

  // the email address needs to be valid
  if (!isEmail(email)) {
    errors.email = 'registration.form.email.invalid'
  }

  // the shortname is allowed to be within 3 to 6 chars
  if (!isLength(shortname, { max: 6, min: 3 })) {
    errors.shortname = 'registration.form.shortname.invalid'
  }

  // password should at least have 7 characters (or more?)
  if (!isLength(password, { max: undefined, min: 7 })) {
    errors.password = 'registration.form.password.invalid'
  }

  // both password fields need to match
  if (passwordRepeat !== password) {
    errors.passwordRepeat = 'registration.form.passwordRepeat.invalid'
  }

  return errors
}

const RegistrationForm = ({ intl, handleSubmit }: Props) =>
  (<form className="ui form error" onSubmit={handleSubmit}>
    <Helmet>
      {createLinks(['button', 'form', 'icon', 'textarea'])}
    </Helmet>

    <div className="personal">
      <Field
        required
        component={SemanticInput}
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'First name',
          id: 'common.form.firstName.label',
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
          id: 'common.form.lastName.label',
        })}
        name="lastName"
        type="text"
      />
      <Field
        required
        component={SemanticInput}
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Email',
          id: 'common.form.email.label',
        })}
        name="email"
        type="email"
      />
    </div>

    <div className="account">
      <Field
        required
        component={SemanticInput}
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Shortname',
          id: 'registration.form.shortname.label',
        })}
        name="shortname"
        type="text"
      />
      <Field
        required
        component={SemanticInput}
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Password',
          id: 'registration.form.password.label',
        })}
        name="password"
        type="password"
      />
      <Field
        required
        component={SemanticInput}
        intl={intl}
        label={intl.formatMessage({
          defaultMessage: 'Repeat password',
          id: 'registration.form.passwordRepeat.label',
        })}
        name="passwordRepeat"
        type="password"
      />
      <div className="field">
        <label htmlFor="useCase">
          <FormattedMessage
            defaultMessage="Use case description"
            id="registration.form.useCase.label"
          />
        </label>
        <Field name="useCase" component="textarea" type="text" />
      </div>

      <Button primary floated="right" type="submit">
        <FormattedMessage defaultMessage="Submit" id="common.form.button.submit" />
      </Button>
    </div>

    <style jsx>{`
      .form {
        display: flex;
        flex-direction: column;
      }
      .account {
        margin-top: 1rem;
      }

      @media all and (min-width: 768px) {
        .form {
          flex-flow: row wrap;
        }
        .personal,
        .account {
          flex: 1 1 50%;
        }
        .personal {
          padding-right: .5rem;
        }
        .account {
          margin: 0;
          padding-left: .5rem;
        }
      }

      @media all and (min-width: 991px) {
        .form {
          border: 1px solid lightgrey;
          padding: 1rem;
        }
      }
    `}</style>
  </form>)

export default reduxForm({
  form: 'registration',
  validate,
})(RegistrationForm)
