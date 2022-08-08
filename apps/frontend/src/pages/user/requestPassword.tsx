import { useMutation } from '@apollo/client'
import { push } from '@socialgouv/matomo-next'
import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Message } from 'semantic-ui-react'

import PasswordRequestForm from '../../components/forms/PasswordRequestForm'
import StaticLayout from '../../components/layouts/StaticLayout'
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
      <div className="p-4 md:w-[500px] items-center">
        <h1 className="mt-0">
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
      </div>
    </StaticLayout>
  )
}

export default RequestPassword
