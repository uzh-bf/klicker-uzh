import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { useApolloClient } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import { useRouter } from 'next/router'

import { StaticLayout } from '../../components/layouts'
import { ActivateAccountMutation } from '../../graphql'
import useLogging from '../../lib/useLogging'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Activate Account',
    id: 'user.activateAccount.pageTitle',
  },
})

function ActivateAccount(): React.ReactElement {
  useLogging({
    logRocket: false,
    slaask: true,
  })

  const client = useApolloClient()
  const router = useRouter()
  const intl = useIntl()

  const [success, setSuccess] = useState(false)

  useEffect((): void => {
    client
      .mutate({ mutation: ActivateAccountMutation, variables: { activationToken: router.query.activationToken } })
      .then((): void => setSuccess(true))
  })

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="activateAccount">
        <h1>
          <FormattedMessage defaultMessage="Activate your new account" id="user.activateAccount.title" />
        </h1>

        {success && (
          <Message success>
            <FormattedMessage
              defaultMessage="Your account has been successfully activated. You can now {login}."
              id="user.activateAccount.success"
              values={{
                login: <Link href="/user/login">login</Link>,
              }}
            />
          </Message>
        )}

        <style jsx>
          {`
            @import 'src/theme';

            .activateAccount {
              padding: 1rem;

              h1 {
                margin-top: 0;
              }

              @include desktop-tablet-only {
                margin: 0 15%;
                width: 500px;
              }
            }
          `}
        </style>
      </div>
    </StaticLayout>
  )
}

export default ActivateAccount
