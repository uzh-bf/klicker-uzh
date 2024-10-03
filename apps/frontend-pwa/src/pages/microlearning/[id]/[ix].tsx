import { GetMicroLearningDocument } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSidePropsContext } from 'next'
import { initializeApollo } from '~/lib/apollo'

function MicrolearningInstance() {
  return null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (
    typeof ctx.params?.id !== 'string' ||
    typeof ctx.params?.ix !== 'string'
  ) {
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
      destination: `/course/${microLearning.data.microLearning.course.id}/microlearning/${microLearning.data.microLearning.id}/${ctx.params.ix}`,
      permanent: false,
    },
  }
}

export default MicrolearningInstance
