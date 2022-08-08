import { useMutation } from '@apollo/client'
import { push } from '@socialgouv/matomo-next'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Message } from 'semantic-ui-react'

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
            <div className="flex flex-col flex-grow mt-2 md:gap-2 md:flex-row">
              <Link passHref href="/questions">
                <Button className="justify-center w-full mb-1 font-bold text-white md:w-1/2 md:mb-0 bg-uzh-blue-80 h-11">
                  <FormattedMessage defaultMessage="No, take me back." id="user.deleteAccount.button.cancel" />
                </Button>
              </Link>

              <Button
                className="justify-center w-full mr-0 font-bold text-white bg-red-700 md:w-1/2 h-11"
                loading={loading}
                onClick={(): void => {
                  deleteAccount({ variables: { deletionToken: router.query.deletionToken } })
                  push(['trackEvent', 'User', 'Account Deleted'])
                }}
              >
                <Button.Label>
                  <FormattedMessage defaultMessage="Yes, I am sure!" id="user.deleteAccount.button.confirm" />
                </Button.Label>
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
