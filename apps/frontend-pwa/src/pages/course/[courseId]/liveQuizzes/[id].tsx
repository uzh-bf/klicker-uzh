import { createTRPCSSRClient } from '@lib/trpc'
import { GetServerSidePropsContext } from 'next'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return uuidPattern.test(value)
}

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

  const quizId = ctx.params.id as string
  const courseId = ctx.params.courseId as string

  if (!isUuid(quizId) || !isUuid(courseId)) {
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
        permanent: false,
      },
    }
  }

  const trpcClient = createTRPCSSRClient(ctx)

  // validate that the live quiz is valid, published and in course
  const liveQuizValid =
    await trpcClient.participant.validateAvailableLiveQuiz.query({
      quizId,
      courseId,
    })

  if (!liveQuizValid.isAvailable) {
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
