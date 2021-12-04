import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { useMutation } from '@apollo/client'
import { Message } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'

import StaticLayout from '../../components/layouts/StaticLayout'
import PasswordRequestForm from '../../components/forms/PasswordRequestForm'
import RequestPasswordMutation from '../../graphql/mutations/RequestPasswordMutation.graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Reset password',
    id: 'user.resetPassword.pageTitle',
  },
})

function RequestPassword(): React.ReactElement {
  const intl = useIntl()

  const [requestPassword, { data, loading, error }] = useMutation(RequestPasswordMutation)

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="resetPassword">
        <h1>
          <FormattedMessage defaultMessage="Reset your password" id="user.requestPassword.title" />
        </h1>

        {((): React.ReactElement => {
          const success = data && !error

          if (success) {
            return (
              <Message success>
                <FormattedMessage
                  defaultMessage="An email has been sent to the provided address. Please follow the instructions therein to regain access to your account."
                  id="user.requestPassword.success"
                />
              </Message>
            )
          }

          return (
            <>
              <PasswordRequestForm
                loading={loading}
                onSubmit={({ email }): void => {
                  requestPassword({ variables: { email } })
                  push(['trackEvent', 'User', 'Password Requested'])
                }}
              />

              {error && <Message error>{error.message}</Message>}
            </>
          )
        })()}

        <style jsx>{`
          @import 'src/theme';

          .resetPassword {
            padding: 1rem;

            h1 {
              margin-top: 0;
            }

            @include desktop-tablet-only {
              margin: 0 15%;
              width: 500px;
            }
          }
        `}</style>
      </div>
    </StaticLayout>
  )
}

export default RequestPassword
