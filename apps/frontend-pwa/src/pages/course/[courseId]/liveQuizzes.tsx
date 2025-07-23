import { GetServerSidePropsContext } from 'next'

function LiveQuizOverviewRedirected() {
  return null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.courseId !== 'string') {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: `/course/${ctx.params.courseId}/liveQuizzes/overview`,
      permanent: false,
    },
  }
}

export default LiveQuizOverviewRedirected
