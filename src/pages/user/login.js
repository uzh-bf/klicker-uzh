import React from 'react'
import PropTypes from 'prop-types'
import { withRouter } from 'next/router'
import Cookies from 'js-cookie'
import Link from 'next/link'
import { compose } from 'recompose'
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
              <Message.Header>Public Beta</Message.Header>
              <Message.Content>
                To participate in the Klicker 2018 public beta with a legacy account, please{' '}
                <Link href="/user/requestPassword">reset your password</Link> first. If you need a new account, you can
                <Link href="/user/registration">sign up here</Link>.
              </Message.Content>
            </Message>
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
                router.push('/questions')
              }}
            />
            {router.query?.expired && <div className="errorMessage message">Login expired. Please login again.</div>}
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
  withLogging({
    logRocket: false,
    slaask: true,
  }),
  pageWithIntl,
  withRouter
)(Login)
