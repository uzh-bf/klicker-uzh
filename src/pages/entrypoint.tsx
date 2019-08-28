import React from 'react'
import { useQuery } from '@apollo/react-hooks'
import { Loader, Message } from 'semantic-ui-react'

import useLogging from '../lib/hooks/useLogging'
import StaticLayout from '../components/layouts/StaticLayout'
import CheckAccountStatusQuery from '../graphql/queries/CheckAccountStatusQuery.graphql'

function Entrypoint(): React.ReactElement {
  useLogging()

  const { data, loading, error } = useQuery(CheckAccountStatusQuery)

  if (loading) {
    return <Loader active />
  }

  if (error) {
    return <Message error>{error.message}</Message>
  }

  return <StaticLayout>{data.checkAccountStatus}</StaticLayout>
}

export default Entrypoint
