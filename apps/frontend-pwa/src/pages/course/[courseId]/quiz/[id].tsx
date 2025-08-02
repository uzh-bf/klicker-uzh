import { GetServerSidePropsContext } from 'next'

function PracticeQuizRedirect() {
  return null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (
    typeof ctx.params?.courseId !== 'string' ||
    typeof ctx.params?.id !== 'string'
  ) {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: `/course/${ctx.params.courseId}/practiceQuizzes/${ctx.params.id}`,
      permanent: false,
    },
  }
}

export default PracticeQuizRedirect
