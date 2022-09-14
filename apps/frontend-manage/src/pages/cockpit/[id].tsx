import { useQuery } from '@apollo/client'
import Layout from '../../components/Layout'
import { GetCockpitSessionDocument, LecturerSession } from '@klicker-uzh/graphql/dist/ops'
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

  // data has not been received yet
  if (cockpitLoading) return <div>Loading...</div>

  // loading is finished, but was not successful
  if (!cockpitData || cockpitError) {
    // TODO fix router instance not available error
    // router.push('/404')
    return null
  }

  const { id, isAudienceInteractionActive, isModerationEnabled, isGamificationEnabled, namespace, name, displayName, status, startedAt, course, activeBlock, blocks, confusionFeedbacks } = cockpitData.cockpitSession as LecturerSession

  return <Layout>TODO</Layout>
}

export default Cockpit
