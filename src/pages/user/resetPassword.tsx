import React from 'react'
import Link from 'next/link'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import { useRouter } from 'next/router'

import { StaticLayout } from '../../components/layouts'
import { PasswordResetForm } from '../../components/forms'
import useLogging from '../../lib/useLogging'
import { ChangePasswordMutation } from '../../graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Reset password',
    id: 'user.resetPassword.pageTitle',
  },
})

function ResetPassword(): React.ReactElement {
  useLogging({
    logRocket: false,
    slaask: true,
  })

  const intl = useIntl()
  const router = useRouter()

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="resetPassword">
        <h1>
          <FormattedMessage defaultMessage="Reset your password" id="user.resetPassword.title" />
        </h1>

        <Mutation mutation={ChangePasswordMutation}>
          {(changePassword, { data, error, loading }): React.ReactElement => {
            const success = data && !error

            if (success) {
              return (
                <Message success>
                  <FormattedMessage
                    defaultMessage="Your password was successfully changed. You can now {login}."
                    id="user.resetPassword.success"
                    values={{
                      login: <Link href="/user/login">login</Link>,
                    }}
                  />
                </Message>
              )
            }

            return (
              <>
                <PasswordResetForm
                  intl={intl}
                  loading={loading}
                  onSubmit={({ password }): Promise<void> =>
                    changePassword({
                      variables: {
                        jwt: router.query.resetToken,
                        newPassword: password,
                      },
                    })
                  }
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

export default ResetPassword
