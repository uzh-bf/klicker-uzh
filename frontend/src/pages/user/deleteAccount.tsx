import React from 'react'
import Link from 'next/link'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { useMutation } from '@apollo/client'
import { Button, Message } from 'semantic-ui-react'
import { useRouter } from 'next/router'
import { push } from '@socialgouv/matomo-next'

import StaticLayout from '../../components/layouts/StaticLayout'
import ResolveAccountDeletionMutation from '../../graphql/mutations/ResolveAccountDeletionMutation.graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Delete Account',
    id: 'user.deleteAccount.pageTitle',
  },
})

function DeleteAccount(): React.ReactElement {
  const router = useRouter()
  const intl = useIntl()

  const [deleteAccount, { data, error, loading }] = useMutation(ResolveAccountDeletionMutation)

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="md:w-[550px] md:items-center p-4">
        <h1 className="mt-0">
          <FormattedMessage
            defaultMessage="Are you sure you want to delete your Klicker account?"
            id="user.deleteAccount.title"
          />
        </h1>

        {((): React.ReactElement => {
          const success = data && !error

          if (success) {
            return (
              <Message success>
                <FormattedMessage
                  defaultMessage="Your Klicker account has been deleted."
                  id="user.deleteAccount.success"
                />
              </Message>
            )
          }

          return (
            <div className="flex flex-col flex-grow md:flex-row">
              <Link href="/questions">
                <Button primary className="!w-full md:!w-1/2 !mb-1 md:!mb-0">
                  <FormattedMessage defaultMessage="No, take me back." id="user.deleteAccount.button.cancel" />
                </Button>
              </Link>

              <Button
                className="!w-full md:!w-1/2 !mr-0"
                color="red"
                loading={loading}
                onClick={(): void => {
                  deleteAccount({ variables: { deletionToken: router.query.deletionToken } })
                  push(['trackEvent', 'User', 'Account Deleted'])
                }}
              >
                <FormattedMessage defaultMessage="Yes, I am sure!" id="user.deleteAccount.button.confirm" />
              </Button>

              {error && <Message error>{error.message}</Message>}
            </div>
          )
        })()}
      </div>
    </StaticLayout>
  )
}

export default DeleteAccount
