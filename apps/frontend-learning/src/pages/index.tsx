import { gql, useQuery } from '@apollo/client'

const GET_LEARNING_ELEMENT = gql`
  query {
    learningElement(id: "ef918af1-ecca-4058-be4b-35c05462c468") {
      id
    }
  }
`

function Index() {
  const { loading, error, data } = useQuery(GET_LEARNING_ELEMENT)

  if (loading) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  return <div className="p-4">{data.learningElement.id}</div>
}

export default Index
