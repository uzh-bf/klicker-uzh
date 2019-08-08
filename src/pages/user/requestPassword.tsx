import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Message } from 'semantic-ui-react'

import { StaticLayout } from '../../components/layouts'
import { PasswordRequestForm } from '../../components/forms'
import useLogging from '../../lib/useLogging'
import { RequestPasswordMutation } from '../../graphql'

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

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="resetPassword">
        <h1>
          <FormattedMessage defaultMessage="Reset your password" id="user.requestPassword.title" />
        </h1>

        <Mutation mutation={RequestPasswordMutation}>
          {(requestPassword, { data, error, loading }): React.ReactElement => {
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
                  intl={intl}
                  loading={loading}
                  onSubmit={({ email }): Promise<void> => requestPassword({ variables: { email } })}
                />

                {error && <Message error>{error.message}</Message>}
              </>
            )
          }}
        </Mutation>

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
