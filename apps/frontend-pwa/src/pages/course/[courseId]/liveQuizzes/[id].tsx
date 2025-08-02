import { ValidateAvailableLiveQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSidePropsContext } from 'next'
import { initializeApollo } from '~/lib/apollo'

function CourseLiveQuiz() {
  return null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (
    typeof ctx.params?.id !== 'string' ||
    typeof ctx.params?.courseId !== 'string'
  ) {
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
        permanent: false,
      },
    }
  }

  const apolloClient = initializeApollo()
  const quizId = ctx.params.id as string
  const courseId = ctx.params.courseId as string

  // validate that the live quiz is valid, published and in course
  const liveQuizValid = await apolloClient.query({
    query: ValidateAvailableLiveQuizDocument,
    variables: { quizId, courseId },
  })

  if (!liveQuizValid.data?.validateAvailableLiveQuiz) {
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: `${ctx.locale ? `/${ctx.locale}` : ''}/session/${quizId}`,
      permanent: false,
    },
  }
}

export default CourseLiveQuiz
