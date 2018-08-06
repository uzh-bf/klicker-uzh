import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { compose } from 'recompose'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Button, Message } from 'semantic-ui-react'
import { withRouter } from 'next/router'

import { StaticLayout } from '../../components/layouts'
import { pageWithIntl, withLogging } from '../../lib'
import { ResolveAccountDeletionMutation } from '../../graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Delete Account',
    id: 'user.deleteAccount.pageTitle',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
  router: PropTypes.object.isRequired,
}

const DeleteAccount = ({ intl, router }) => (
  <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
    <div className="deleteAccount">
      <h1>
        <FormattedMessage
          defaultMessage="Are you sure you want to delete your Klicker account?"
          id="user.deleteAccount.title"
        />
      </h1>

      <Mutation mutation={ResolveAccountDeletionMutation}>
        {(deleteAccount, { data, error, loading }) => {
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
                onClick={() =>
                  deleteAccount({
                    variables: {
                      deletionToken: router.query.deletionToken,
                    },
                  })
                }
              >
                <FormattedMessage defaultMessage="Yes, I am sure!" id="user.deleteAccount.button.confirm" />
              </Button>
              {error && <Message error>{error.message}</Message>}
            </>
          )
        }}
      </Mutation>

      <style jsx>
        {`
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
        `}
      </style>
    </div>
  </StaticLayout>
)

DeleteAccount.propTypes = propTypes

export default compose(
  withRouter,
  withLogging({
    logRocket: false,
    slaask: true,
  }),
  pageWithIntl
)(DeleteAccount)
