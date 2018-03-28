import React from 'react'
import Router from 'next/router'
import Cookies from 'js-cookie'
import { compose } from 'recompose'
import { FormattedMessage, intlShape } from 'react-intl'
import { Mutation } from 'react-apollo'

import { StaticLayout } from '../../components/layouts'
import { LoginForm } from '../../components/forms'
import { LoginMutation } from '../../graphql'
import { pageWithIntl, withData, withLogging } from '../../lib'

const propTypes = {
  intl: intlShape.isRequired,
}

const Login = ({ intl }) => (
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

      <Mutation mutation={LoginMutation}>
        {(login, { loading, error }) => (
          <React.Fragment>
            <LoginForm
              intl={intl}
              loading={loading}
              onSubmit={async ({ email, password }) => {
                // perform the login
                const { data } = await login({ variables: { email, password } })

                // save the user id in a cookie
                if (data.login) {
                  Cookies.set('userId', data.login)
                }

                // redirect to question pool
                Router.push('/questions')
              }}
            />
            {error && <div className="errorMessage message">Login failed ({error.message})</div>}
          </React.Fragment>
        )}
      </Mutation>

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
)(Login)
