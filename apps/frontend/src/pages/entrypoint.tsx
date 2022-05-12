import React, { useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import { useRouter } from 'next/router'
import { useLazyQuery } from '@apollo/client'
import { Message } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'

import CheckAccountStatusQuery from '../graphql/queries/CheckAccountStatusQuery.graphql'

function Entrypoint(): React.ReactElement {
  const router = useRouter()

  const [checkAccountStatus, { data, error }] = useLazyQuery(CheckAccountStatusQuery)

  const [redirectPath, setRedirectPath] = useState('/questions')

  useEffect(() => {
    const urlParams = new URLSearchParams(window?.location?.search)
    if (urlParams.get('redirect_to')) {
      setRedirectPath(`/${decodeURIComponent(urlParams?.get('redirect_to'))}`)
    }
  }, [])

  useEffect((): void => {
    checkAccountStatus()
    if (data && data.checkAccountStatus) {
      push(['trackEvent', 'User', 'AAI Login'])

      Cookies.set('userId', data.checkAccountStatus, { secure: true })
      router.push(redirectPath)
    }
  }, [data])

  if (error) {
    return <Message error>{error.message}</Message>
  }

  return null
}

export default Entrypoint
