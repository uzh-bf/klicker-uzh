import React, { useEffect } from 'react'
import Cookies from 'js-cookie'
import Link from 'next/link'
import _get from 'lodash/get'
import { useRouter } from 'next/router'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { useMutation } from '@apollo/react-hooks'
import { Message } from 'semantic-ui-react'

import StaticLayout from '../../components/layouts/StaticLayout'
import LoginForm from '../../components/forms/LoginForm'
import LoginMutation from '../../graphql/mutations/LoginMutation.graphql'
import useLogging from '../../lib/hooks/useLogging'
import { withApollo } from '../../lib/apollo'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Login',
    id: 'user.login.pageTitle',
  },
})

function Login(): React.ReactElement {
  useLogging({
    logRocket: false,
    slaask: true,
  })

  const intl = useIntl()
  const router = useRouter()

  useEffect((): void => {
    router.prefetch('/questions')
    router.prefetch('/sessions')
  }, [])

  const [login, { loading, error }] = useMutation(LoginMutation)

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="login">
        <h1>
          <FormattedMessage defaultMessage="Login" id="user.login.title" />
        </h1>

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
            loading={loading}
            onSubmit={async ({ email, password }): Promise<void> => {
              // perform the login
              const loginResult: any = await login({ variables: { email, password } })

              // save the user id in a cookie
              if (loginResult.data.login) {
                Cookies.set('userId', loginResult.data.login, { secure: true })
              }

              // redirect to question pool
              router.push('/questions')
            }}
          />

          <div className="aai">
            <a href="https://aai.klicker.uzh.ch/public" role="button">
              <img alt="AAI Login" src="https://www.switch.ch/aai/design/images/aai_login_button.png" />
            </a>
          </div>

          {!error && _get(router, 'query.expired') && (
            <div className="errorMessage message">Login expired. Please login again.</div>
          )}

          {error && <div className="errorMessage message">Login failed ({error.message})</div>}
        </>

        <style jsx>{`
          @import 'src/theme';

          .login {
            padding: 1rem;

            h1 {
              margin-top: 0;
            }

            .aai {
              margin-top: 1rem;
              text-align: right;
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
        `}</style>
      </div>
    </StaticLayout>
  )
}

export default withApollo()(Login)
