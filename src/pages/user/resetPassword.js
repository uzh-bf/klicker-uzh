import React from 'react'
import PropTypes from 'prop-types'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import Link from 'next/link'

import { StaticLayout } from '../../components/layouts'
import { PasswordResetForm } from '../../components/forms'
import { pageWithIntl, withData } from '../../lib'
import { ChangePasswordMutation } from '../../graphql'

const propTypes = {
  error: PropTypes.oneOfType(PropTypes.string, null).isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  success: PropTypes.oneOfType(PropTypes.string, null).isRequired,
}

const ResetPassword = ({
  intl, handleSubmit, success, error,
}) => (
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

      {success && (
        <Message success>
          <FormattedMessage
            defaultMessage="Your password was successfully changed. You can now {login}."
            id="user.resetPassword.success"
            values={{
              login: <Link href="/user/login">login</Link>,
            }}
          />
        </Message>
      )}
      {!success && <PasswordResetForm intl={intl} onSubmit={handleSubmit} />}
      {error && <Message error>{error}</Message>}

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
  withData,
  pageWithIntl,
  graphql(ChangePasswordMutation),
  withState('error', 'setError', null),
  withState('success', 'setSuccess', null),
  withHandlers({
    // handle form submission
    handleSubmit: ({
      mutate, setError, setSuccess, url,
    }) => async ({ password }) => {
      try {
        await mutate({ variables: { jwt: url.query.resetToken, newPassword: password } })
        setSuccess('Success')
      } catch ({ message }) {
        console.error(message)
        setError(message)
      }
    },
  }),
)(ResetPassword)
