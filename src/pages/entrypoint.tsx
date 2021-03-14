import { useLazyQuery } from '@apollo/client'
import Cookies from 'js-cookie'
import { useRouter } from 'next/router'
import React, { useEffect } from 'react'
import { Message } from 'semantic-ui-react'
import CheckAccountStatusQuery from '../graphql/queries/CheckAccountStatusQuery.graphql'
import { withApollo } from '../lib/apollo'
import useLogging from '../lib/hooks/useLogging'

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

export default withApollo()(Entrypoint)
