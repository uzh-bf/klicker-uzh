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
  invalid: boolean,
  handleSubmit: (values: {
    email: string,
    password: string,
  }) => mixed,
}

const validate = ({ email = '', password = '' }) => {
  const errors = {}

  // the email address needs to be valid
  if (!isEmail(email)) {
    errors.email = 'form.email.invalid'
  }

  // password should at least have 7 characters (or more?)
  if (!isLength(password, { max: undefined, min: 1 })) {
    errors.password = 'form.password.invalid'
  }

  return errors
}

const LoginForm = ({ intl, invalid, handleSubmit }: Props) =>
  (<form className="ui form error" onSubmit={handleSubmit}>
    <Helmet>
      {createLinks(['button', 'form', 'icon'])}
    </Helmet>

    <Field
      required
      component={SemanticInput}
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
      intl={intl}
      label={intl.formatMessage({
        defaultMessage: 'Password',
        id: 'form.password.label',
      })}
      name="password"
      type="password"
    />

    <Button primary className="semanticButton" disabled={invalid} type="submit">
      <FormattedMessage defaultMessage="Submit" id="form.button.submit" />
    </Button>

    <style jsx>{`
      .form {
        display: flex;
        flex-direction: column;
      }

      .form :global(.semanticButton) {
        margin-right: 0;
      }

      @media all and (min-width: 768px) {
        .form :global(.semanticButton) {
          flex: 0 0 auto;
          align-self: flex-end;

          margin-right: 0;
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
  form: 'login',
  validate,
})(LoginForm)
