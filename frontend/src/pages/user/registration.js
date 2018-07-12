import React from 'react'
import { compose } from 'recompose'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import Link from 'next/link'

import { StaticLayout } from '../../components/layouts'
import { RegistrationForm } from '../../components/forms'
import { RegistrationMutation } from '../../graphql'
import { pageWithIntl, withLogging } from '../../lib'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Registration',
    id: 'user.registration.pageTitle',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
}

const Registration = ({ intl }) => (
  <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
    <div className="registration">
      <h1>
        <FormattedMessage
          defaultMessage="Registration"
          id="user.registration.title"
        />
      </h1>

      <Mutation mutation={RegistrationMutation}>
        {(register, { loading, data, error }) => {
          const newEmail = data && data.createUser.email

          if (newEmail) {
            return (
              <div className="successMessage">
                <FormattedMessage
                  defaultMessage="Successfully registered as {newEmail}.{br} Please login at {link}."
                  id="user.registration.successNotification"
                  values={{
                    br: <br />,
                    link: <Link href="/user/login">/user/login</Link>,
                    newEmail,
                  }}
                />
              </div>
            )
          }

          return (
            <React.Fragment>
              <Message info>
                <Message.Header>Public Beta</Message.Header>
                <Message.Content>
                  Sign up for the Klicker 2018 public beta. Already have an
                  account? <Link href="/user/login">Login here.</Link>
                </Message.Content>
              </Message>
              <RegistrationForm
                intl={intl}
                loading={loading}
                onSubmit={({
                  email,
                  password,
                  shortname,
                  institution,
                  useCase,
                }) => {
                  register({
                    variables: {
                      email,
                      institution,
                      password,
                      shortname,
                      useCase,
                    },
                  })
                }}
              />
              {error && (
                <div className="errorMessage">
                  Registration failed (
                  {error.message}
                  )
                </div>
              )}
            </React.Fragment>
          )
        }}
      </Mutation>

      <style jsx>
        {`
          @import 'src/theme';

          .registration {
            padding: 1rem;

            h1 {
              margin-top: 0;
            }

            .errorMessage,
            .successMessage {
              font-weight: bold;
            }
            .errorMessage {
              color: $color-error-font;
            }
            .successMessage {
              color: $color-success;
            }

            @include desktop-tablet-only {
              width: 750px;
            }
          }
        `}
      </style>
    </div>
  </StaticLayout>
)

Registration.propTypes = propTypes

export default compose(
  withLogging({
    logRocket: false,
  }),
  pageWithIntl,
)(Registration)
