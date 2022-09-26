import { useQuery } from '@apollo/client'
import { GetUserQuestionsDocument } from '@klicker-uzh/graphql/dist/ops'

import Layout from '../components/Layout'

function Index() {
  const {
    loading: loadingQuestions,
    error: errorQuestions,
    data: dataQuestions,
  } = useQuery(GetUserQuestionsDocument)

  console.log(dataQuestions?.userQuestions)

  return (
    <Layout displayName="Fragepool">
      <div>Welcome to the management frontend.</div>
      <div>
        Go to{' '}
        <a href="/sessions" className="text-uzh-blue-80">
          Session List
        </a>
      </div>
    </Layout>
  )
}

export default Index
