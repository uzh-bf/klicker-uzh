import { GetMicroLearningDocument } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSidePropsContext } from 'next'
import { initializeApollo } from '~/lib/apollo'

function MicrolearningEvaluation() {
  return null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.id !== 'string') {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  const apolloClient = initializeApollo()

  const microLearning = await apolloClient.query({
    query: GetMicroLearningDocument,
    variables: { id: ctx.params.id },
  })

  if (!microLearning.data?.microLearning?.course?.id) {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: `/course/${microLearning.data.microLearning.course.id}/microlearning/${microLearning.data.microLearning.id}/evaluation`,
      permanent: false,
    },
  }
}

export default MicrolearningEvaluation
