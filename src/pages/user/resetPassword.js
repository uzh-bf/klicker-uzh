import React from 'react'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import Link from 'next/link'

import { StaticLayout } from '../../components/layouts'
import { PasswordResetForm } from '../../components/forms'
import { pageWithIntl, withData, withLogging } from '../../lib'
import { ChangePasswordMutation } from '../../graphql'

const propTypes = {
  intl: intlShape.isRequired,
  url: PropTypes.object.isRequired,
}

const ResetPassword = ({ intl, url }) => (
  <StaticLayout
    pageTitle={intl.formatMessage({
      defaultMessage: 'Reset password',
      id: 'user.resetPassword.pageTitle',
    })}
  >
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
            <React.Fragment>
              <PasswordResetForm
                intl={intl}
                loading={loading}
                onSubmit={({ password }) => {
                  changePassword({
                    variables: { jwt: url.query.resetToken, newPassword: password },
                  })
                }}
              />
              {error && <Message error>{error.message}</Message>}
            </React.Fragment>
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

ResetPassword.propTypes = propTypes

export default compose(
  withLogging({
    logRocket: false,
  }),
  withData,
  pageWithIntl,
)(ResetPassword)
