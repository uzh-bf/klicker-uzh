// @flow

import React from 'react'
import isEmail from 'validator/lib/isEmail'
import { FormattedMessage } from 'react-intl'
import { Field, reduxForm } from 'redux-form'
import { Button, Form } from 'semantic-ui-react'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../lib'

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

const validate = ({ email = '', shortname, password, passworRepeat }) => {
  const errors = {}
  if (isEmail(email)) {
    errors.email = 'Fail email'
  }
  return errors
}

const renderField = ({ input, label, type, meta: { touched, error, warning } }) =>
  (<Field error={error}>
    <label forHtml={input.name}>
      {label}
    </label>
    <input {...input} type={type} />
  </Field>)

const RegistrationForm = ({ email, handleSubmit }: Props) =>
  (<form className="ui form" onSubmit={handleSubmit}>
    <Helmet>
      {createLinks(['button', 'form'])}
    </Helmet>

    {email}

    <div className="personal">
      <div>
        <Field name="firstName" component={renderField} type="text" />
      </div>
      <div>
        <label htmlFor="lastName">
          <FormattedMessage id="common.string.lastName" defaultMessage="Last name" />
        </label>
        <Field name="lastName" component={renderField} type="text" />
      </div>
      <div>
        <label htmlFor="email">
          <FormattedMessage id="common.string.email" defaultMessage="Email" />
        </label>
        <Field name="email" component={renderField} type="email" />
      </div>
    </div>

    <div className="account">
      <div>
        <label htmlFor="shortname">
          <FormattedMessage id="common.string.shortname" defaultMessage="Shortname" />
        </label>
        <Field name="shortname" component={renderField} type="text" />
      </div>
      <div>
        <label htmlFor="password">
          <FormattedMessage id="common.string.password" defaultMessage="Password" />
        </label>
        <Field name="password" component={renderField} type="password" />
      </div>
      <div>
        <label htmlFor="passwordRepeat">
          <FormattedMessage id="common.string.passwordRepeat" defaultMessage="Repeat password" />
        </label>
        <Field name="passwordRepeat" component={renderField} type="password" />
      </div>
      <div>
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
