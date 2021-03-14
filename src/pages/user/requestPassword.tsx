import { useMutation } from '@apollo/client'
import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Message } from 'semantic-ui-react'
import PasswordRequestForm from '../../components/forms/PasswordRequestForm'
import StaticLayout from '../../components/layouts/StaticLayout'
import RequestPasswordMutation from '../../graphql/mutations/RequestPasswordMutation.graphql'
import { withApollo } from '../../lib/apollo'
import useLogging from '../../lib/hooks/useLogging'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Reset password',
    id: 'user.resetPassword.pageTitle',
  },
})

function RequestPassword(): React.ReactElement {
  useLogging({
    slaask: true,
  })

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

export default withApollo()(RequestPassword)
