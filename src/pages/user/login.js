import React from 'react'
import PropTypes from 'prop-types'
import Cookies from 'js-cookie'
import Link from 'next/link'
import _get from 'lodash/get'
import Router, { withRouter } from 'next/router'
import { compose, lifecycle } from 'recompose'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Mutation } from 'react-apollo'
import { Message } from 'semantic-ui-react'
import { StaticLayout } from '../../components/layouts'
import { LoginForm } from '../../components/forms'
import { LoginMutation } from '../../graphql'
import { pageWithIntl, withLogging } from '../../lib'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Login',
    id: 'user.login.pageTitle',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
  router: PropTypes.object.isRequired,
}

const Login = ({ intl, router }) => (
  <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
    <div className="login">
      <h1>
        <FormattedMessage defaultMessage="Login" id="user.login.title" />
      </h1>

      <Mutation mutation={LoginMutation}>
        {(login, { loading, error }) => (
          <>
            <Message info>
              <FormattedMessage
                defaultMessage="To login with a legacy account, please {requestLink} first. If you need a new account, you can {signupLink} here."
                id="user.login.infoMessage"
                values={{
                  requestLink: (
                    <Link href="/user/requestPassword">
                      <a>
                        <FormattedMessage defaultMessage="reset your password" id="form.login.infoMessageResetPW" />
                      </a>
                    </Link>
                  ),
                  signupLink: (
                    <Link href="/user/registration">
                      <a>
                        <FormattedMessage defaultMessage="sign up" id="form.login.infoMessageSignup" />
                      </a>
                    </Link>
                  ),
                }}
              />
            </Message>
            <LoginForm
              intl={intl}
              loading={loading}
              onSubmit={async ({ email, password }) => {
                // perform the login
                const { data } = await login({ variables: { email, password } })

                // save the user id in a cookie
                if (data.login) {
                  Cookies.set('userId', data.login, { secure: true })
                }

                // redirect to question pool
                router.push('/questions')
              }}
            />
            {!error && _get(router, 'query.expired') && (
              <div className="errorMessage message">Login expired. Please login again.</div>
            )}
            {error && <div className="errorMessage message">Login failed ({error.message})</div>}
          </>
        )}
      </Mutation>

      <style jsx>
        {`
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

            .marginTop {
              margin-top: 0.5rem;
            }

            @include desktop-tablet-only {
              width: 500px;
            }
          }
        `}
      </style>
    </div>
  </StaticLayout>
)

Login.propTypes = propTypes

export default compose(
  lifecycle({
    componentDidMount() {
      Router.prefetch('/questions')
    },
  }),
  withLogging({
    logRocket: false,
    slaask: true,
  }),
  pageWithIntl,
  withRouter
)(Login)
