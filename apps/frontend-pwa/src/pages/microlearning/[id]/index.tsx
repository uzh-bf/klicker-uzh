import { GetMicroLearningDocument } from '@klicker-uzh/graphql/dist/ops'
import { initializeApollo } from '@lib/apollo'
import { GetServerSidePropsContext } from 'next'

function MicrolearningIntroduction() {
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
      destination: `/course/${microLearning.data.microLearning.course.id}/microlearning/${microLearning.data.microLearning.id}`,
      permanent: false,
    },
  }
}

export default MicrolearningIntroduction
