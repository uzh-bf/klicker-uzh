import React from 'react'
import Link from 'next/link'
import { compose } from 'recompose'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Button, Message } from 'semantic-ui-react'
import { useRouter } from 'next/router'

import { StaticLayout } from '../../components/layouts'
import { withLogging } from '../../lib'
import { ResolveAccountDeletionMutation } from '../../graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Delete Account',
    id: 'user.deleteAccount.pageTitle',
  },
})

function DeleteAccount(): React.ReactElement {
  const router = useRouter()
  const intl = useIntl()

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="deleteAccount">
        <h1>
          <FormattedMessage
            defaultMessage="Are you sure you want to delete your Klicker account?"
            id="user.deleteAccount.title"
          />
        </h1>

        <Mutation mutation={ResolveAccountDeletionMutation}>
          {(deleteAccount, { data, error, loading }): any => {
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
              <>
                <Link href="/questions">
                  <Button primary>
                    <FormattedMessage defaultMessage="No, take me back." id="user.deleteAccount.button.cancel" />
                  </Button>
                </Link>

                <Button
                  color="red"
                  loading={loading}
                  onClick={(): void => deleteAccount({ variables: { deletionToken: router.query.deletionToken } })}
                >
                  <FormattedMessage defaultMessage="Yes, I am sure!" id="user.deleteAccount.button.confirm" />
                </Button>

                {error && <Message error>{error.message}</Message>}
              </>
            )
          }}
        </Mutation>

        <style jsx>{`
          @import 'src/theme';

          .deleteAccount {
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

export default compose(
  withLogging({
    logRocket: false,
    slaask: true,
  })
)(DeleteAccount)
