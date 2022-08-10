import { gql, useQuery } from '@apollo/client'
import { useRouter } from 'next/router'

const GET_LEARNING_ELEMENT = gql`
  query GetLearningElement($id: ID!) {
    learningElement(id: $id) {
      id
      course {
        id
      }
      instance {
        id
        questionData
      }
    }
  }
`

function Index() {
  const router = useRouter()

  const { loading, error, data } = useQuery(GET_LEARNING_ELEMENT, {
    variables: {
      id: router.query.id,
    },
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  return (
    <div className="p-4">
      {data.learningElement.instance.questionData.content}
    </div>
  )
}

export default Index
