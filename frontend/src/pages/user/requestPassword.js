import React from 'react'
import PropTypes from 'prop-types'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import { Message } from 'semantic-ui-react'

import { StaticLayout } from '../../components/layouts'
import { PasswordRequestForm } from '../../components/forms'
import { pageWithIntl, withData, withLogging } from '../../lib'
import { RequestPasswordMutation } from '../../graphql'

const propTypes = {
  error: PropTypes.oneOfType(PropTypes.string, null).isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  success: PropTypes.oneOfType(PropTypes.string, null).isRequired,
}

const RequestPassword = ({
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
        <FormattedMessage defaultMessage="Reset your password" id="user.requestPassword.title" />
      </h1>

      {success && (
        <Message success>
          <FormattedMessage
            defaultMessage="An email has been sent to the provided address. Please follow the instructions therein to regain access to your account."
            id="user.requestPassword.success"
          />
        </Message>
      )}
      {!success && <PasswordRequestForm intl={intl} onSubmit={handleSubmit} />}
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

RequestPassword.propTypes = propTypes

export default compose(
  withLogging(['ga', 'raven']),
  withData,
  pageWithIntl,
  graphql(RequestPasswordMutation),
  withState('error', 'setError', null),
  withState('success', 'setSuccess', null),
  withHandlers({
    // handle form submission
    handleSubmit: ({ mutate, setError, setSuccess }) => async ({ email }) => {
      try {
        await mutate({ variables: { email } })
        setSuccess(email)
      } catch ({ message }) {
        console.error(message)
        setError(message)
      }
    },
  }),
)(RequestPassword)
