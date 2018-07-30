import React from 'react'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import Link from 'next/link'
import { withRouter } from 'next/router'

import { StaticLayout } from '../../components/layouts'
import { PasswordResetForm } from '../../components/forms'
import { pageWithIntl, withLogging } from '../../lib'
import { ChangePasswordMutation } from '../../graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Reset password',
    id: 'user.resetPassword.pageTitle',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
  router: PropTypes.object.isRequired,
}

const ResetPassword = ({ intl, router }) => (
  <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
    <div className="resetPassword">
      <h1>
        <FormattedMessage defaultMessage="Reset your password" id="user.resetPassword.title" />
      </h1>

      <Mutation mutation={ChangePasswordMutation}>
        {(changePassword, { data, error, loading }) => {
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
                onSubmit={({ password }) => {
                  changePassword({
                    variables: {
                      jwt: router.query.resetToken,
                      newPassword: password,
                    },
                  })
                }}
              />
              {error && <Message error>{error.message}</Message>}
            </>
          )
        }}
      </Mutation>

      <style jsx>
        {`
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
        `}
      </style>
    </div>
  </StaticLayout>
)

ResetPassword.propTypes = propTypes

export default compose(
  withRouter,
  withLogging({
    logRocket: false,
    slaask: true,
  }),
  pageWithIntl
)(ResetPassword)
