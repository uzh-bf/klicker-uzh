import { GetServerSidePropsContext } from 'next'

function MicroLearningOverviewRedirected() {
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
      destination: `/course/${ctx.params.courseId}/microLearnings/overview`,
      permanent: false,
    },
  }
}

export default MicroLearningOverviewRedirected
