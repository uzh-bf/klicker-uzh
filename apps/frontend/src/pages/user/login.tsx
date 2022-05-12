import React, { useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import _get from 'lodash/get'
import { useRouter } from 'next/router'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { useMutation } from '@apollo/client'
import getConfig from 'next/config'
import { push } from '@socialgouv/matomo-next'

import StaticLayout from '../../components/layouts/StaticLayout'
import LoginForm from '../../components/forms/LoginForm'
import LoginMutation from '../../graphql/mutations/LoginMutation.graphql'

const { publicRuntimeConfig } = getConfig()

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Login',
    id: 'user.login.pageTitle',
  },
})

function Login(): React.ReactElement {
  const intl = useIntl()
  const router = useRouter()

  const [redirectPath, setRedirectPath] = useState('/questions')

  useEffect(() => {
    const urlParams = new URLSearchParams(window?.location?.search)
    if (urlParams.get('redirect_to')) {
      setRedirectPath(`/${decodeURIComponent(urlParams?.get('redirect_to'))}`)
    }
  }, [])

  useEffect((): void => {
    router.prefetch('/questions')
    router.prefetch('/sessions')
  }, [])

  const [login, { loading, error }] = useMutation(LoginMutation)

  return (
    <StaticLayout pageTitle={intl.formatMessage(messages.pageTitle)}>
      <div className="p-4 md:w-[600px]">
        <h1 className="mt-0">
          <FormattedMessage defaultMessage="Login" id="user.login.title" />
        </h1>

        <>
          <LoginForm
            loading={loading}
            onSubmit={async ({ email, password }): Promise<void> => {
              // perform the login
              const loginResult: any = await login({ variables: { email, password } })

              // save the user id in a cookie
              if (loginResult.data.login) {
                Cookies.set('userId', loginResult.data.login, { secure: true })
              }

              push(['trackEvent', 'User', 'Logged In'])

              // redirect to the specified redirect path (default: question pool)
              router.push(redirectPath)
            }}
          />

          {publicRuntimeConfig.withAai && (
            <div className="mt-4 text-right">
              <a href="https://aai.klicker.uzh.ch/public" role="button">
                <img alt="AAI Login" src="https://www.switch.ch/aai/design/images/aai_login_button.png" />
              </a>
            </div>
          )}

          {!error && _get(router, 'query.expired') && (
            <div className="font-bold text-red-800">Login expired. Please login again.</div>
          )}

          {error && <div className="font-bold text-red-800">Login failed ({error.message})</div>}
        </>
      </div>
    </StaticLayout>
  )
}

export default Login
