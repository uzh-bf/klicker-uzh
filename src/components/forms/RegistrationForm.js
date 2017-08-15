// @flow

import React from 'react'
import isEmail from 'validator/lib/isEmail'
import { FormattedMessage } from 'react-intl'
import { Field, reduxForm } from 'redux-form'
import { Button } from 'semantic-ui-react'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../lib'
import { SemanticInput } from './components'

type Props = {
  handleSubmit: (values: {
    firsName: string,
    lastName: string,
    email: string,
    shortname: string,
    password: string,
    passwordRepeat: string,
    useCase: string,
  }) => mixed,
}

const validate = ({ email = '' }) => {
  const errors = {}

  if (!isEmail(email)) {
    errors.email = 'Fail email'
  }

  return errors
}

const RegistrationForm = ({ handleSubmit }: Props) =>
  (<form className="ui form error" onSubmit={handleSubmit}>
    <Helmet>
      {createLinks(['button', 'form', 'icon', 'textarea'])}
    </Helmet>

    <div className="personal">
      <Field required component={SemanticInput} label="First name" name="firstName" type="text" />
      <Field required component={SemanticInput} label="Last name" name="lastName" type="text" />
      <Field required component={SemanticInput} label="Email" name="email" type="email" />
    </div>

    <div className="account">
      <Field required component={SemanticInput} label="Shortname" name="shortname" type="text" />
      <Field required component={SemanticInput} label="Password" name="password" type="password" />
      <Field
        required
        component={SemanticInput}
        label="Repeat password"
        name="passwordRepeat"
        type="password"
      />
      <div className="field">
        <label htmlFor="useCase">
          <FormattedMessage id="common.string.useCase" defaultMessage="Use case" />
        </label>
        <Field name="useCase" component="textarea" type="text" />
      </div>

      <Button primary floated="right" type="submit">
        <FormattedMessage id="common.string.submit" defaultMessage="Submit" />
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
