// @flow

import React from 'react'
import { Helmet } from 'react-helmet'
import { Button, Segment } from 'semantic-ui-react'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage } from 'react-intl'

import { createLinks, withData, pageWithIntl } from '../../lib'

import StaticLayout from '../../components/layouts/StaticLayout'

class Registration extends React.Component {
  props: {
    intl: $IntlShape,
    handleSubmit: () => mixed,
  }

  state: {}

  constructor(props) {
    super(props)
    this.state = {}
  }

  render() {
    const { intl, handleSubmit } = this.props

    return (
      <StaticLayout>
        <div className="registration">
          <Helmet>
            {createLinks(['button', 'form', 'segment'])}
          </Helmet>

          <h1>
            <FormattedMessage id="user.registration.title" defaultMessage="Registration" />
          </h1>

          <form className="ui form" onSubmit={handleSubmit}>
            <div className="personal">
              <div className="field">
                <label htmlFor="firstName">
                  <FormattedMessage id="common.string.firstname" defaultMessage="First name" />
                </label>
                <Field name="firstName" component="input" type="text" />
              </div>
              <div className="field">
                <label htmlFor="lastName">
                  <FormattedMessage id="common.string.lastName" defaultMessage="Last name" />
                </label>
                <Field name="lastName" component="input" type="text" />
              </div>
              <div className="field">
                <label htmlFor="email">
                  <FormattedMessage id="common.string.email" defaultMessage="Email" />
                </label>
                <Field name="email" component="input" type="email" />
              </div>
            </div>

            <div className="account">
              <div className="field">
                <label htmlFor="shortName">
                  <FormattedMessage id="common.string.shortName" defaultMessage="Shortname" />
                </label>
                <Field name="shortName" component="input" type="text" />
              </div>
              <div className="field">
                <label htmlFor="password">
                  <FormattedMessage id="common.string.password" defaultMessage="Password" />
                </label>
                <Field name="password" component="input" type="password" />
              </div>
              <div className="field">
                <label htmlFor="passwordRepeat">
                  <FormattedMessage
                    id="common.string.passwordRepeat"
                    defaultMessage="Repeat password"
                  />
                </label>
                <Field name="passwordRepeat" component="input" type="password" />
              </div>
              <div className="field">
                <label htmlFor="useCase">
                  <FormattedMessage id="common.string.useCase" defaultMessage="Use case" />
                </label>
                <Field name="useCase" component="textarea" type="text" />
              </div>

              <Button primary floated="right" type="submit">
                Submit
              </Button>
            </div>
          </form>

          <style jsx>{`
            .registration {
              padding: 0 1rem 1rem 1rem;
            }

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
              .registration {
                margin: 0 15%;
              }

              .form {
                border: 1px solid lightgrey;
                padding: 1rem;
              }
            }
          `}</style>
        </div>
      </StaticLayout>
    )
  }
}

export default withData(
  reduxForm({
    form: 'registration',
  })(pageWithIntl(Registration)),
)
