import React from 'react'
import Router from 'next/router'
import PropTypes from 'prop-types'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'

import { StaticLayout } from '../../components/layouts'
import { LoginForm } from '../../components/forms'
import { LoginMutation } from '../../graphql/mutations'
import { pageWithIntl, withData } from '../../lib'

const propTypes = {
  error: PropTypes.oneOfType(PropTypes.string, null).isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

const Login = ({ intl, error, handleSubmit }) => (
  <StaticLayout
    pageTitle={intl.formatMessage({
      defaultMessage: 'Login',
      id: 'user.login.pageTitle',
    })}
  >
    <div className="login">
      <h1>
        <FormattedMessage id="user.login.title" defaultMessage="Login" />
      </h1>

      {/* TODO: improve message handling */}
      {error && <div className="errorMessage message">Login failed: {error}</div>}

      <LoginForm intl={intl} onSubmit={handleSubmit} />

      <style jsx>{`
        @import 'src/theme';

        .login {
          padding: 1rem;
        }

        h1 {
          margin-top: 0;
        }

        .message {
          font-weight: bold;
        }
        .errorMessage {
          color: $color-error;
        }
        .successMessage {
          color: $color-success;
        }

        @include desktop-tablet-only {
          .login {
            width: 500px;
          }
        }
      `}</style>
    </div>
  </StaticLayout>
)

Login.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(LoginMutation),
  withState('error', 'setError', null),
  withHandlers({
    // handle form submission
    handleSubmit: ({ mutate, setError }) => async ({ email, password }) => {
      try {
        await mutate({ variables: { email, password } })

        // redirect to question pool
        Router.push('/questions')
      } catch ({ message }) {
        console.error(message)
        setError(message)
      }
    },
  }),
)(Login)
