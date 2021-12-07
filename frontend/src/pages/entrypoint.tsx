import React, { useEffect } from 'react'
import Cookies from 'js-cookie'
import { useRouter } from 'next/router'
import { useLazyQuery } from '@apollo/client'
import { Message } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'

import CheckAccountStatusQuery from '../graphql/queries/CheckAccountStatusQuery.graphql'

function Entrypoint(): React.ReactElement {
  const router = useRouter()

  const [checkAccountStatus, { data, error }] = useLazyQuery(CheckAccountStatusQuery)

  useEffect((): void => {
    checkAccountStatus()
    if (data && data.checkAccountStatus) {
      push(['trackEvent', 'User', 'AAI Login'])

      Cookies.set('userId', data.checkAccountStatus, { secure: true })
      router.push('/questions')
    }
  }, [data])

  if (error) {
    return <Message error>{error.message}</Message>
  }

  return null
}

export default Entrypoint
