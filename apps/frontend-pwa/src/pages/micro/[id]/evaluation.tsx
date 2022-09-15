import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { GetMicroSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'

function Evaluation() {
  const router = useRouter()

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id: router.query.id as string },
    skip: !router.query.id,
  })

  if (loading || !data?.microSession) {
    return <div>loading</div>
  }

  return (
    <Layout
      displayName={data.microSession.displayName}
      courseName={data.microSession.course.displayName}
      mobileMenuItems={[]}
    >
      hello world
    </Layout>
  )
}

export default Evaluation
