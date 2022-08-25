import { useQuery } from '@apollo/client'
import { GetSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'

function Index() {
  const router = useRouter()

  const { loading, error, data } = useQuery(GetSessionDocument, {
    variables: {
      sessionId: router.query.id as string,
    },
  })


  if (loading || !data) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  console.log(data)

  return (
    <div className="p-4">
        {router.query.id}
    </div>
  )
}

export default Index
