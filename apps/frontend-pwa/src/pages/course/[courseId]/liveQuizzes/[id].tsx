import { ValidateAvailableLiveQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSidePropsContext } from 'next'
import ParticipantRedirect from '../../../../components/ParticipantRedirect'
import getParticipantToken from '../../../../lib/getParticipantToken'
import { participantRedirect } from '../../../../lib/participantRedirect'
import { initializeApollo } from '../../../../lib/apollo'

function CourseLiveQuiz(props: {
  participantToken: string
  redirectTo: string
}) {
  return <ParticipantRedirect {...props} />
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

  const auth = await getParticipantToken({ apolloClient, courseId, ctx })
  return participantRedirect({
    destination: `${ctx.locale ? `/${ctx.locale}` : ''}/session/${quizId}`,
    ...auth,
    locale: ctx.locale,
  })
}

export default CourseLiveQuiz
