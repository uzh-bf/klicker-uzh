import { useQuery } from "@apollo/client"
import { GetSessionEvaluationDocument } from "@klicker-uzh/graphql/dist/ops"
import { useRouter } from 'next/router'

function Evaluation() {
  const router = useRouter()

  const { data, loading, error } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 10000,
    skip: !router.query.id,
  })

  console.log(data)

  return <div>Session Evaluation goes here</div>
}

export default Evaluation
