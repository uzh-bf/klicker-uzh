import React from 'react'
import Router from 'next/router'
import PropTypes from 'prop-types'
import Cookies from 'js-cookie'
import { compose, withState, withHandlers } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { graphql } from 'react-apollo'

import { StaticLayout } from '../../components/layouts'
import { LoginForm } from '../../components/forms'
import { LoginMutation } from '../../graphql'
import { pageWithIntl, withData, withLogging } from '../../lib'

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
        <FormattedMessage defaultMessage="Login" id="user.login.title" />
      </h1>

      <LoginForm intl={intl} onSubmit={handleSubmit} />

      {/* TODO: improve message handling */}
      {error && <div className="errorMessage message">Login failed ({error})</div>}

      <style jsx>{`
        @import 'src/theme';

        .login {
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
            width: 500px;
          }
        }
      `}</style>
    </div>
  </StaticLayout>
)

Login.propTypes = propTypes

export default compose(
  withLogging({
    chatlio: false,
    logRocket: false,
  }),
  withData,
  pageWithIntl,
  graphql(LoginMutation),
  withState('error', 'setError', null),
  withHandlers({
    // handle form submission
    handleSubmit: ({ mutate, setError }) => async ({ email, password }) => {
      try {
        const { data } = await mutate({ variables: { email, password } })

        // save the user id in a cookie
        if (data.login) {
          Cookies.set('userId', data.login)
        }

        // redirect to question pool
        Router.push('/questions')
      } catch ({ message }) {
        console.error(message)
        setError(message)
      }
    },
  }),
)(Login)
