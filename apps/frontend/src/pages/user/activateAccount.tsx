import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { useApolloClient } from '@apollo/client'
import { Message } from 'semantic-ui-react'
import { useRouter } from 'next/router'
import { push } from '@socialgouv/matomo-next'

import StaticLayout from '../../components/layouts/StaticLayout'
import ActivateAccountMutation from '../../graphql/mutations/ActivateAccountMutation.graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Activate Account',
    id: 'user.activateAccount.pageTitle',
  },
})

function ActivateAccount(): React.ReactElement {
  const client = useApolloClient()
  const router = useRouter()
  const intl = useIntl()

  const [success, setSuccess] = useState(false)

  useEffect((): void => {
    client
      .mutate({ mutation: ActivateAccountMutation, variables: { activationToken: router.query.activationToken } })
      .then((): void => setSuccess(true))

    push(['trackEvent', 'User', 'Account Activated'])
  }, [])

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="p-4 w-[500px] text-center mx-auto">
        <h1 className="mt-0">
          <FormattedMessage defaultMessage="Activate your new account" id="user.activateAccount.title" />
        </h1>

        {success && (
          <Message success className="!text-left">
            <FormattedMessage
              defaultMessage="Your account has been successfully activated. You can now {login}."
              id="user.activateAccount.success"
              values={{
                login: <Link href="/user/login">login</Link>,
              }}
            />
          </Message>
        )}
      </div>
    </StaticLayout>
  )
}

export default ActivateAccount
