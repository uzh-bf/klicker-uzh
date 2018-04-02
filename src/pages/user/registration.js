import React from 'react'
import PropTypes from 'prop-types'
import { compose, withState, withHandlers } from 'recompose'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import Link from 'next/link'

import { StaticLayout } from '../../components/layouts'
import { RegistrationForm } from '../../components/forms'
import { RegistrationMutation } from '../../graphql'
import { pageWithIntl, withData, withLogging } from '../../lib'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Registration',
    id: 'user.registration.pageTitle',
  },
})

const propTypes = {
  error: PropTypes.oneOfType(PropTypes.string, null).isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  success: PropTypes.oneOfType(PropTypes.string, null).isRequired,
}

const Registration = ({
  intl, error, success, handleSubmit,
}) => (
  <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
    <div className="registration">
      <h1>
        <FormattedMessage defaultMessage="Registration" id="user.registration.title" />
      </h1>

      {!success && <RegistrationForm intl={intl} onSubmit={handleSubmit} />}

      {/* TODO: improve message handling */}
      {error && <div className="errorMessage message">Registration failed ({error})</div>}
      {success && (
        <div className="successMessage message">
          Successfully registered as {success}. <br />
          Please login at <Link href="/user/login">/user/login</Link> after the activation of your
          account.
        </div>
      )}

      <style jsx>{`
        @import 'src/theme';

        .registration {
          padding: 1rem;

          h1 {
            margin-top: 0;
          }

          .message {
            font-weight: bold;
          }
          .errorMessage {
            color: $color-error-font;
          }
          .successMessage {
            color: $color-success;
          }

          @include desktop-tablet-only {
            width: 750px;
          }
        }
      `}</style>
    </div>
  </StaticLayout>
)

Registration.propTypes = propTypes

export default compose(
  withLogging(['ga', 'raven']),
  withData,
  pageWithIntl,
  graphql(RegistrationMutation),
  withState('error', 'setError', null),
  withState('success', 'setSuccess', null),
  withHandlers({
    // handle form submission
    handleSubmit: ({ mutate, setError, setSuccess }) => async ({ email, password, shortname }) => {
      try {
        const result = await mutate({ variables: { email, password, shortname } })
        setSuccess(result.data.createUser.email)
      } catch ({ message }) {
        console.error(message)
        setError(message)
      }
    },
  }),
)(Registration)
