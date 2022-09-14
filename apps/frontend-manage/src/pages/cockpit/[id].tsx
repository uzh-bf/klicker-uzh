// import { Session } from '@klicker-uzh/graphql/dist/ops'
import { useQuery } from '@apollo/client'
import Layout from '../../components/Layout'
import { GetCockpitSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'

function Cockpit() {
  const router = useRouter()

  const {
    loading: cockpitLoading,
    error: cockpitError,
    data: cockpitData,
  } = useQuery(GetCockpitSessionDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 10000,
    skip: !router.query.id,
  })

  if (cockpitLoading) return <div>Loading...</div>

  // loading is finished, but was not successful
  if (!cockpitData || cockpitError) {
    // TODO fix router instance not available error
    // router.push('/404')
    return null
  }

  console.log(cockpitData.cockpitSession)

  return <Layout>TODO</Layout>
}

export default Cockpit

// TODO: add confusion feedback to query - all within a certain time horizon and directly compute the average in the backend