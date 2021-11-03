import React from 'react'
import Link from 'next/link'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { useMutation } from '@apollo/client'
import { Message } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'

import { Errors } from '../../constants'
import StaticLayout from '../../components/layouts/StaticLayout'
import RegistrationForm from '../../components/forms/RegistrationForm'
import RegistrationMutation from '../../graphql/mutations/RegistrationMutation.graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Registration',
    id: 'user.registration.pageTitle',
  },
})

function Registration(): React.ReactElement {
  const intl = useIntl()

  const [register, { data, error, loading }] = useMutation(RegistrationMutation)

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="registration">
        <h1>
          <FormattedMessage defaultMessage="Registration" id="user.registration.title" />
        </h1>

        {((): React.ReactElement => {
          const newEmail = data && data.createUser.email

          if (newEmail) {
            return (
              <div className="successMessage">
                <FormattedMessage
                  defaultMessage="Successfully registered as {newEmail}.{br} Please activate your new account using the link in the email we just sent you. You can then login at {link}."
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
                  defaultMessage="You don't need an account to respond to polls; just visit the given /join page of your lecturer and respond anonymously. However, feel free to create an account if you would like to create polls yourself."
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
                loading={loading}
                onSubmit={async (
                  { email, password, shortname, institution, useCase },
                  { setSubmitting, setFieldError }
                ): Promise<void> => {
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
                    push(['trackEvent', 'User', 'Signed Up'])
                  } catch ({ message }) {
                    if (message === Errors.SHORTNAME_NOT_AVAILABLE) {
                      setFieldError('shortname', 'NOT_AVAILABLE')
                      push(['trackEvent', 'User', 'Shortname Not Available'])
                    }

                    if (message === Errors.EMAIL_NOT_AVAILABLE) {
                      setFieldError('email', 'NOT_AVAILABLE')
                      push(['trackEvent', 'User', 'Email Not Available'])
                    }

                    setSubmitting(false)
                  }
                }}
              />

              {error && <div className="errorMessage">Registration failed ({error.message})</div>}
            </>
          )
        })()}

        <style jsx>{`
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
        `}</style>
      </div>
    </StaticLayout>
  )
}

export default Registration
