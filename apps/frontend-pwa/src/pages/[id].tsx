import { useQuery } from '@apollo/client'
import { GetLearningElementDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'

function Index() {
  const router = useRouter()

  const { loading, error, data } = useQuery(GetLearningElementDocument, {
    variables: {
      id: router.query.id as string,
    },
  })

  if (loading || !data) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  return (
    <div className="p-4">

    </div>
  )
}

export default Index
