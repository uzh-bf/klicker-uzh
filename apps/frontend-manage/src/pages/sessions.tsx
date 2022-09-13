import { useQuery } from '@apollo/client'
import { GetUserSessionsDocument } from '@klicker-uzh/graphql/dist/ops'

import Layout from '../components/Layout'

function SessionList() {
  const {
    loading: loadingSessions,
    error: errorSessions,
    data: dataSessions,
  } = useQuery(GetUserSessionsDocument)

  console.log(dataSessions)

  return (
    <Layout displayName="Sessions">
      <div>SessionList</div>
    </Layout>
  )
}

export default SessionList
