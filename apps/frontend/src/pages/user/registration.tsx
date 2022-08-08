import { useMutation } from '@apollo/client'
import { push } from '@socialgouv/matomo-next'
import Link from 'next/link'
import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Message } from 'semantic-ui-react'

import RegistrationForm from '../../components/forms/RegistrationForm'
import StaticLayout from '../../components/layouts/StaticLayout'
import { Errors } from '../../constants'
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
      <div className="p-4 md:w-[750px]">
        <h1 className="mt-0">
          <FormattedMessage defaultMessage="Registration" id="user.registration.title" />
        </h1>

        {((): React.ReactElement => {
          const newEmail = data && data.createUser.email

          if (newEmail) {
            return (
              <div className="font-bold text-green-700">
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
                      push(['trackEvent', 'Error', 'Shortname Not Available'])
                    }

                    if (message === Errors.EMAIL_NOT_AVAILABLE) {
                      setFieldError('email', 'NOT_AVAILABLE')
                      push(['trackEvent', 'Error', 'Email Not Available'])
                    }

                    setSubmitting(false)
                  }
                }}
              />

              {error && <div className="font-bold text-red-800">Registration failed ({error.message})</div>}
            </>
          )
        })()}
      </div>
    </StaticLayout>
  )
}

export default Registration
