import React from 'react'
import { compose } from 'recompose'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import Link from 'next/link'

import { Errors } from '../../constants'
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
        <FormattedMessage defaultMessage="Registration" id="user.registration.title" />
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
            <>
              <Message warning>
                <FormattedMessage
                  defaultMessage="You dont need an account to respond to polls; just visit the given /join page of your
                lecturer and respond anonymously. However, feel free to create an account if you would like to create
                polls yourself."
                  id="user.registration.studentAccountWarning"
                />
              </Message>
              <Message info>
                <FormattedMessage
                  defaultMessage="Already have an account? {loginLink}"
                  id="user.registration.loginInfo"
                  values={{
                    loginLink: (
                      <Link href="/user/login">
                        <a>
                          <FormattedMessage defaultMessage="Login here." id="user.registration.loginInfoLink" />
                        </a>
                      </Link>
                    ),
                  }}
                />
              </Message>
              <RegistrationForm
                intl={intl}
                loading={loading}
                onSubmit={async (
                  { email, password, shortname, institution, useCase },
                  { setSubmitting, setFieldError }
                ) => {
                  try {
                    await register({
                      variables: {
                        email,
                        institution,
                        password,
                        shortname,
                        useCase,
                      },
                    })
                  } catch ({ message }) {
                    if (message === Errors.SHORTNAME_NOT_AVAILABLE) {
                      setFieldError('shortname', 'NOT_AVAILABLE')
                    }
                    if (message === Errors.EMAIL_NOT_AVAILABLE) {
                      setFieldError('email', 'NOT_AVAILABLE')
                    }

                    setSubmitting(false)
                  }
                }}
              />
              {error && <div className="errorMessage">Registration failed ({error.message})</div>}
            </>
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
    slaask: true,
  }),
  pageWithIntl
)(Registration)
