import React, { useEffect } from 'react'
import Cookies from 'js-cookie'
import { useRouter } from 'next/router'
import { useLazyQuery } from '@apollo/client'
import { Message } from 'semantic-ui-react'

import useLogging from '../lib/hooks/useLogging'
import CheckAccountStatusQuery from '../graphql/queries/CheckAccountStatusQuery.graphql'

function Entrypoint(): React.ReactElement {
  useLogging()

  const router = useRouter()

  const [checkAccountStatus, { data, error }] = useLazyQuery(CheckAccountStatusQuery)

  useEffect((): void => {
    checkAccountStatus()
    if (data && data.checkAccountStatus) {
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
