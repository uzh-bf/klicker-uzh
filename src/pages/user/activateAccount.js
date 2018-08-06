import React from 'react'
import PropTypes from 'prop-types'
import { compose, lifecycle } from 'recompose'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import Link from 'next/link'
import { withRouter } from 'next/router'

import { StaticLayout } from '../../components/layouts'
import { pageWithIntl, withLogging } from '../../lib'
import { ActivateAccountMutation } from '../../graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Activate Account',
    id: 'user.activateAccount.pageTitle',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
  success: PropTypes.bool.isRequired,
}

const ActivateAccount = ({ intl, success }) => (
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

ActivateAccount.propTypes = propTypes

export default compose(
  withRouter,
  withLogging({
    logRocket: false,
    slaask: true,
  }),
  pageWithIntl,
  graphql(ActivateAccountMutation, { name: 'activateAccount' }),
  lifecycle({
    componentDidMount() {
      this.props
        .activateAccount({
          variables: {
            activationToken: this.props.router.query.activationToken,
          },
        })
        .then(() => {
          this.setState({
            success: true,
          })
        })
    },
  })
)(ActivateAccount)
